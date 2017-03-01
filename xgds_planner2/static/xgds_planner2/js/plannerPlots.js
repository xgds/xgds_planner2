//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__


UPDATE_ON = {
		UpdatePlanDuration: 2,
		ModifyEnd: 1,
		Save: 0
}

BLANKS = '';

$.extend(playback, {
	plot : {
	lastUpdate: undefined,
	invalid: false,
	initialized: false,
	getTimeFromPathElement: function(pathElement) {
		var startTime = app.getStartTime();
		if (pathElement._simInfo == undefined){
			app.simulatePlan();
		}
		return startTime.add(pathElement._simInfo.elapsedTimeSeconds, 's');
	},
	initialize: function() {
		if (this.initialized){
			return;
		}
		moment.tz.setDefault(app.getTimeZone());
		var _this = this;
		app.listenTo(app.vent, 'itemSelected:station', function(selected) {
			_this.doSetTime(_this.getTimeFromPathElement(selected)); 
        });
        app.listenTo(app.vent, 'itemSelected:segment', function(selected) {
			_this.doSetTime(_this.getTimeFromPathElement(selected)); 
        });
		this.initialized = true;
	},
	doSetTime: function(currentTime){
		this.lastUpdate = moment(currentTime);
		app.vent.trigger('updatePlotTime', this.lastUpdate.toDate().getTime());
	},
	start: function(currentTime){
		this.doSetTime(currentTime);
	},
	update: function(currentTime){
	    if (this.lastUpdate === undefined){
			this.doSetTime(currentTime);
			return;
		}
		var delta = currentTime.diff(this.lastUpdate);
		if (Math.abs(delta) >= 100) {
			this.doSetTime(currentTime);
		}
	},
	pause: function() {
		// noop
	}
}});

var PlotDataModel = Backbone.Model.extend({
	
	defaults: {
		'lineColor':     'blue',
		'usesPosition':    false,
	   	'update': UPDATE_ON.UpdatePlanDuration,
	   	'inverse': false,
	   	'visible': true
	},

	initialize: function(startMoment, endMoment) {
	},

	getDataValues: function(startMoment, endMoment, intervalSeconds) {
		return [];
	},

	getLineColor: function() {
		return this.get('lineColor');
	},

	getLabel: function() {
		return this.get('label');
	}

});

var PlotDataTileModel = PlotDataModel.extend({
	defaults: {
		'lineColor':     'blue',
		'usesPosition':    true,
		'update': UPDATE_ON.ModifyEnd,
		'inverse': false,
		'visible': true
	},
	initialize: function(startMoment, endMoment) {
		this.initializeDataTileView();
		this.listenTo(app.vent, 'dataTileLoaded', function(uuid){
			if (uuid == this.get('dataSourceUuid')){
				app.vent.trigger('drawPlot',this.get('name'));
			}
		});
	},
	
	loadDataSource: function() {
		// force load of data source
		var uuid = this.get('dataSourceUuid');
		if (uuid != undefined){
			app.vent.trigger('preloadNode', uuid);
		}
	},
	
	initializeDataTileView: function() {
		if (this.dataTileView === undefined){
			if (app.dataTile === undefined) {
				app.dataTile = {};
			}
			this.dataTileView = app.dataTile[this.get('name')];
			if (this.dataTileView === undefined) {
				this.loadDataSource();
			}
		}
		return (this.dataTileView !== undefined);
	},
	
	getDataValues: function(startMoment, endMoment, intervalSeconds, coordinates) {
		var result = [];
		var rawResult = [];
		var loaded = this.initializeDataTileView();
		if (!loaded){
			return result;
		}
		var max = this.get('maxValue');
		var min = this.get('minValue');
		
		var times = Object.keys(coordinates);
		for (var i=0; i<times.length; i++){
			var theTime = times[i];
			var position = coordinates[theTime];
			var badPosition = false;
			if (position == null || position == undefined || position.length < 2){
				badPosition = true;
			}
			if (!badPosition){
				var value = this.dataTileView.getRawDataValue(position);
				rawResult.push([theTime, value]);
				// convert to percentage
				var percentValue = null;
				if (value != null) {
					percentValue = 100.0 * ((value - min) / (max - min));
					if (this.get('inverse')) {
						percentValue = 100.0 - percentValue;
					}
				}
				result.push([theTime, percentValue]);
			}
		}

		if (_.isEmpty(result)){
			return [];
		}
		return { 'percentValues': result,
				 'rawValues': rawResult};
	}
});

app.views.PlanPlotView = Marionette.View.extend({
//	el: '#plot-container',
	rendering: false,
	template: '#plot_contents',
	plotLabels : {},
	dataPlots: {},
	plotDataCache: {},
	rawDataCache: {},
	intervalSeconds: 5,
	needsCoordinates: false,
	defaultStationColor: '#FFA500',
	selectedStationColor: '#FF4000',
	plotOptions: { 
        series: {
			lines: { show: true },
			points: { show: false }
		},
		clickable: true,
        grid: {
        	backgroundColor: '#FFFFFF',
            hoverable: true,
            clickable: true,
            autoHighlight: true,
            margin: {
                top: 5,
                left: 0,
                bottom: 5,
                right: 0
            },
            axisMargin: 0,
            borderWidth: 1,
            borderColor: '#C0C0C0'
        },
        shadowSize: 0,
        zoom: {
            interactive: true
        },
        pan: {
            interactive: true
        },
        axisLabels: {
            show: false
        },
        yaxis: {
            max: 100, // set a manual maximum to allow for labels
            ticks: 0 // this line removes the y ticks
        },
        legend: {
        	show: false
        }
    },
    updatePlotDuration: function() {
    	var newOptions = this.getXAxisOptions();
    	if (newOptions != null){
    		Object.assign(this.plotOptions['xaxis'], newOptions);
    		this.cacheAllPlotData(UPDATE_ON.UpdatePlanDuration);
    		this.onRender();
    		return true;
    	}
    	return false;
    },
    getTickSize: function(durationSeconds) {
    	if (durationSeconds > 12){
    		var twelfth = moment.duration(durationSeconds/12, 'seconds');
    		this.intervalSeconds = Math.round(twelfth.asSeconds()/40);
    		var m_12 = twelfth.minutes();
    		var h_12 = twelfth.hours();
    		var d_12 = twelfth.days();
    		if (d_12 > 0){
    			return [d_12, 'day'];
    		} else if (h_12 > 0){
    			if (m_12 > 30) {
    				h_12++;
    			}
    			return [h_12, 'hour'];
    		} else if (m_12 > 0) {
    			if (twelfth.seconds() > 30) {
    				m_12++;
    			}
    			return [m_12, 'minute'];
    		}
    	}
    	return null; // auto scale
    },
    getXAxisOptions: function() {
    	var durationSeconds = app.currentPlan._simInfo.deltaTimeSeconds;
    	if (this.lastDurationSeconds != undefined){
    		if (this.lastDurationSeconds == durationSeconds){
    			return null;
    		}
    		var delta = moment.duration(durationSeconds/12, 'seconds');
    		if (Math.abs(durationSeconds - this.lastDurationSeconds) < delta.asSeconds()){
    			return null;
    		}
    	}
    	
    	result =  { mode: 'time',
		  			timeformat: DEFAULT_PLOT_TIME_FORMAT,
		  			timezone: app.getTimeZone(),
		  			reserveSpace: false
			   	  };
		this.lastDurationSeconds = durationSeconds;
    	var mduration = moment.duration(durationSeconds, 'seconds');
    	var tickSize = this.getTickSize(durationSeconds);
    	var timeformat = DEFAULT_PLOT_TIME_FORMAT;
    	if (tickSize != null){
    		if (tickSize[1] == 'day'){
    			timeformat = '%m/%d';
    		} else if (mduration.hours() > 12){
    			timeformat = '%m/%d %H:%M';
    		}
    	} else {
    		result['tickSize'] = tickSize;
    	}
    	result['timeformat'] = timeformat;
    	
    	return result;
    },
    initialized: false,
    initialize: function() {
    	var context = this;
    	this.lastDataIndex = -1;
    	this.lastDataIndexTime = -1;
    	this.plotOptions['grid']['markings'] = function() {
    		if (app.currentPlan._simInfo === undefined){
        		app.simulatePlan();
        		context.getStartEndMoments(true);
        	}
    		return planPlots.getStationMarkings(context.startEndTimes);
    	};
    	this.plotColors = this.getPlotColors();
    	this.plotOptions['colors'] = context.plotColors;
    	this.listenTo(app.vent, 'modifyEnd', function(model) {this.updatePlots(UPDATE_ON.ModifyEnd)});
    	this.listenTo(app.vent, 'station:change', function(model) {this.updatePlots(UPDATE_ON.ModifyEnd)});
    	this.listenTo(app.vent, 'save', function(model) {this.updatePlots(UPDATE_ON.Save)});
    	this.listenTo(app.vent, 'drawPlot', function(key) {this.updatePlot(key)}); //TODO just render the specific plot
    	this.listenTo(app.vent, 'updatePlotTime', function(currentTime) {
    		var index = context.getPlotIndex(currentTime);
    		if (index > -1){
    			context.selectData(index);
    		} else {
    			// todo clear
    		}
    	});
    	this.listenTo(app.vent, 'station:remove',  function(model){ this.removeStationLabel(model);
    		this.onRender()
    	}, this);
    	this.listenTo(app.vent, 'itemSelected:station', function(selected) {
    		this.selectStation(selected);
        }, this);
        this.listenTo(app.vent, 'itemSelected:segment', function(selected) {
        	this.selectSegment(selected);
        }, this);
    	this.listenTo(app.vent, 'showItem:command', function(command) {
    		this.selectCommand(command);
    	}, this);
    	this.listenTo(app.vent, 'showNothing', this.selectNothing, this);
    	this.listenTo(app.vent, 'clearSelectedStation', this.selectNothing, this);
    	this.listenTo(app.vent, 'onPlanLoaded', this.finishInitialization, this);
    },
    finishInitialization: function() {
    	// once we know the plan is loaded we can reference it.
    	this.constructPlotDataModels();
    	this.needsCoordinates = this.calculateNeedsCoordinates();
    	this.plotOptions['xaxis'] = this.getXAxisOptions(); 
    	this.getStartEndMoments(true);
    	this.listenTo(app.vent, 'updatePlanDuration', function(model) {this.updatePlots(UPDATE_ON.UpdatePlanDuration)});
    	this.initialized = true;
    	this.onRender();
    	playback.addListener(playback.plot);
    },
    selectNothing: function() {
    	planPlots.lastSelectedStation = undefined;
    	if (this.plot !== undefined){
    		this.plot.setupGrid();
    		this.plot.draw();
    	}
    },
    selectStation: function(station){
    	planPlots.lastSelectedStation = station;
    	if (this.plot !== undefined){
    		this.plot.setupGrid();
    		this.plot.draw();
    	}
    },
    selectSegment: function(segment){
    	// right now we do nothing
    	this.selectNothing();
    },
    selectCommand: function(command){
    	var relation = command.getRelation('pathElement');
    	if (relation === undefined) {
    		return;
    	}
    	var related = command.getRelation('pathElement').related;
    	if (related.get('type') == 'Station'){
    		this.selectStation(related);
    	} else {
    		this.selectSegment(related);
    	}
    },
	getPlotIndex: function(currentTime){
		var timedeltaMS = Math.abs(this.lastDataIndexTime - currentTime);
		if (timedeltaMS/1000 >= this.intervalSeconds){
			// we should change it, find the next index.
			var start = this.startEndTimes[0].start;
			var planDurationSeconds = app.currentPlan._simInfo.deltaTimeSeconds;
			var numDataBuckets = Math.round(planDurationSeconds/this.intervalSeconds);
			var secondsFromStart = (currentTime - start.toDate().getTime())/1000;
			var timePercentage = secondsFromStart / planDurationSeconds;
			var suggestedBucket = Math.round(timePercentage * numDataBuckets);
			var foundIndex = suggestedBucket;
			
			// verify time in data
			// spot checked and the algorithm seems to always pick good buckets
			/*
			var plotData = this.plot.getData();
			if (this.sampleData == undefined) {
				for (var i=0; i<plotData.length; i++){
					label = plotData[i].label;
					if (label !== undefined){
						this.sampleData = plotData[i];
						i = plotData.length;
					}
				}
			}
			if (this.sampleData != undefined){
				var dataAtIndex = this.sampleData.data[foundIndex];
				// otherwise we would check the time of this one, check previous and next and see which is closest.
			} */
			
			if (this.lastDataIndex != foundIndex){
				this.lastDataIndex = foundIndex;
				this.lastDataIndexTime = currentTime;
			}
		}
		return this.lastDataIndex;
	},
	
	loadLegendCookie: function(key) {
		var cookieVisible = Cookies.get(key);
		var visible = true;
		if (cookieVisible != undefined){
			visible = (cookieVisible == 'true');
		} else {
			Cookies.set(key, true);
		}
		return visible;
	},
    drawLegendLabels: function() {
    	var context = this;
    	var keys = Object.keys(this.dataPlots);
    	for (var i=0; i<keys.length; i++) {
    		var label=keys[i];
    		var underLabel = label.split(' ').join('_');
    		var theColor = this.dataPlots[label].getLineColor();
    		var content = '<div id="' + underLabel + 'legend_div" style="display:inline-block; min-width: 180px;"><input type="checkbox" id="' + underLabel + '_checkbox" value="' + label + '">&nbsp;<span id="' + underLabel + '_label" style="color:' + theColor + '">' + label + ':</span><span id="' + underLabel + '_value">' + BLANKS + '</span></div>';
    		$("#plotLegend").append(content);
    		var visible = this.loadLegendCookie(label);
    		$("#" + underLabel + "_checkbox").prop('checked', visible);
    		this.dataPlots[label].set('visible', visible);
    		$("#" + underLabel + "_checkbox").change(function() {
    			var id = $(this).attr('id');
    			var checked = $(this).is(":checked");
    			Cookies.set($(this).attr('value'), checked);
    			context.togglePlot($(this).attr('value'), checked);
    	    });
    	}
    },
    togglePlot(key, visible){
    	var dataPlot = this.dataPlots[key];
    	if (dataPlot.get('visible') != visible){
    		dataPlot.set('visible', visible);
    		this.onRender();
    	}
    },
    removeStationLabel: function(model){
    	try {
    		if (model.get('type') == 'Station'){
    			var stationUuid = model.get('uuid');
    			var foundLabel = this.plotLabels[stationUuid];
    			foundLabel.remove();
    			delete foundLabel[stationUuid];
    		}
    	} catch (err){
    		// skip
    	}
    },
    drawStationLabels: function() {
    	// draw labels
		var context = this;
		var index = 0;
		var sequence = app.currentPlan.get('sequence');
		var saveUs = [];
		var deathRow = []
		var plotDiv = this.$el.find("#plotDiv");
		sequence.each(function(pathElement, i, sequence) {
    		if (pathElement.attributes.type == 'Station'){
    			var startEndTime = this.startEndTimes[index];
    			if (startEndTime !== undefined) {
	    			var o = context.plot.pointOffset({ x: startEndTime.start.toDate().getTime(), y: 0 });
	    			if (pathElement.attributes.uuid in context.plotLabels){
	    				context.plotLabels[pathElement.attributes.uuid].text(pathElement._sequenceLabel);
	    				context.plotLabels[pathElement.attributes.uuid].css({top: (o.top - 20), left: (o.left + 4), position:'absolute'});
	    			} else {
	    				var el = $("<div id='plotLabel_" + pathElement.attributes.uuid + "' style='position:absolute;left:" + (o.left + 4) + "px;top:" + (o.top - 20) + "px;color:black;font-weight:bold;'>" + pathElement._sequenceLabel + "</div>");
	    				el.appendTo(plotDiv);
	    				context.plotLabels[pathElement.attributes.uuid] = el;
	    			}
	        		saveUs.push(pathElement.attributes.uuid);
	    			index++;
    			}
    		}
		}, this);
//		_.each(Object.keys(context.plotLabels), function(key){
//			if (saveUs.indexOf(key) < 0){
//				deathRow.push(key);
//			}
//		});
//		_.each(deathRow, function(key){
//			context.plotLabels[key].remove();
//			delete context.plotLabels[key];
//		});
    },
    constructPlotDataModels: function(){
    	var context = this;
    	$.each( app.options.plots, function(key,value){
    		var model = $.executeFunctionByName(value + '.constructModel', window);
    		context.dataPlots[model.get('name')] = model;
    	});
    },
    initializePlots: function(startMoment, endMoment){
    	$.each( this.dataPlots, function(key,plotModel){
    		plotModel.initialize(startMoment, endMoment);
    		});
    },
    calculateNeedsCoordinates: function() {
    	var result = false;
    	$.each( this.dataPlots, function(key,plotModel){
    		if (!result){
    			result = (plotModel.get('usesPosition'));
    		}
    	});
    	return result;
    },
    getPlotColors: function(){
    	var result = [];
    	$.each( this.dataPlots, function(key,plotModel){
    		if (plotModel.get('visible')){
    			result.push(plotModel.get('lineColor'));
    		}
    	});
    	return result;
    },
    getStartEndMoments: function(refresh) {
    	if (refresh){
    		this.startEndTimes = app.getStationStartEndTimes();
    	}
    	if (_.isEmpty(this.startEndTimes)){
    		return undefined;
    	}
    	return {start: this.startEndTimes[0].start,
    			end: this.startEndTimes[this.startEndTimes.length - 1].end}
    	
    },
    getCoordinates: function(startMoment, endMoment) {
    	var result = {};
    	var nowMoment = startMoment.clone();
    	var index = 0;
    	playback.vehicleDriver.analyze();
    	while (nowMoment.isBefore(endMoment)){
    		var position = playback.vehicleDriver.lookupTransform(nowMoment, {indexVariable: index});
    		if (position !== null){
    			result[nowMoment.toDate().getTime()] = position.location;
    		}
			nowMoment = nowMoment.add(this.intervalSeconds, 's');
		}
    	return result;
    },
    getStationData: function() {
    	// we have to have some data in the plot, so if there are no registered plots then
    	// just use the station data
    	var stationData = [];
    	for (var i=0; i<this.startEndTimes.length; i++){
    		var stationStartTime = this.startEndTimes[i].start.toDate().getTime();
    		stationData.push([stationStartTime, 0]);
    		var stationEndTime = this.startEndTimes[i].end.toDate().getTime();
    		if (stationStartTime != stationEndTime){
    			stationData.push([stationEndTime, 0]);
    		}
    		stationData.push(null);
    	}
    	return [stationData];
    },
    cacheAllPlotData: function(eventType){
    	var startEnd = this.getStartEndMoments(true);
    	if (startEnd === undefined){
    		return;
    	}

    	var coordinates = undefined;
    	if (this.needsCoordinates){
    		coordinates = this.getCoordinates(startEnd.start, startEnd.end);
    	}
    	var context = this;

    	$.each( this.dataPlots, function(key, plotModel){
    		if (eventType == plotModel.get('update') || !(key in context.plotDataCache)) {
    			context.updatePlot(key, coordinates, plotModel);
    		}
    	});
    },
    getPlotDataFromCache: function() {
    	var result = [];
    	var context = this;
    	$.each( this.dataPlots, function(key,plotModel){
    		if (key in context.plotDataCache){
    			if (plotModel.get('visible')){
		    		var data = context.plotDataCache[key];
		    		if (data != undefined && !_.isEmpty(data)){
		    			result.push({'label': key,
			 			 		 	'data': data});
		    		}
    			}
    		}
    	});
    	return result;
    },
    buildPlotDataArray: function() {
    	var plotData = this.getPlotDataFromCache();
		if (_.isEmpty(plotData)){
			plotData = this.getStationData();
		} else {
			plotData.push({data:this.getStationData()[0]});
		}
		return plotData;
    },
    updatePlot: function(key, coordinates, plotModel) {
    	var startEnd = this.getStartEndMoments(false);
    	if (startEnd === undefined){
    		return;
    	}

    	if (plotModel === undefined) {
    		plotModel = this.dataPlots[key];
    	}
    	
    	if (this.needsCoordinates && coordinates === undefined){
    		coordinates = this.getCoordinates(startEnd.start, startEnd.end);
    	}
    	var dataValues = plotModel.getDataValues(startEnd.start, 
    											 startEnd.end,
    											 this.intervalSeconds,
    											 coordinates);
    	if (!_.isEmpty(dataValues)) {
			try {
				this.plotDataCache[key] = dataValues.percentValues;
				this.rawDataCache[key] = dataValues.rawValues;
			} catch (err) {
				this.plotDataCache[key] = dataValues;
			}
	    	this.onRender();
		}
    },
    updatePlots: function(eventType) {
    	var updated = false;
    	if (eventType == UPDATE_ON.UpdatePlanDuration){
    		updated = this.updatePlotDuration();
    	} 
    	if (!updated){
    		this.cacheAllPlotData( eventType);
    		this.onRender();
    	}
    },
    selectData: function(index) {
    	if (this.plot != undefined){
	    	this.plot.unhighlight();
			var plotData = this.plot.getData();
			var time = null;
			var value = null;
			var label = undefined;
			for (var i=0; i<plotData.length; i++){
				label = plotData[i].label;
				if (label !== undefined){
					var dataAtIndex = plotData[i].data[index];
					this.plot.highlight(i, index);
					
					if (dataAtIndex != undefined) {
						var rawDataCache = this.rawDataCache[label];
						if (time == null){
							time = dataAtIndex[0];
							value = rawDataCache[index][1];
						} else if (time == dataAtIndex[0]) {
							value = rawDataCache[index][1];
						}
					}
					
					this.updateDataValue(label, value);
				}
				label = undefined;
			}
			this.updateTimeValue(time);
    	}
    },
    updateDataValue(label, value){
    	// show the value from the plot below the plot.
    	var labelValue = ('#' + label + '_value');
    	var labelValue = labelValue.split(' ').join('_');
    	if (value != null && value != undefined){
			value = value.toFixed(2);
			$(labelValue).text(value);
		} else {
			$(labelValue).text(BLANKS);
		}
    	
    },
    updateTimeValue(newTime){
    	//TODO update the time for the slider maybe
    },
    handleResize: function(event) {
    	if (this.plot != undefined) {
    		this.drawStationLabels();
    	}
    },
	onRender: function() {
		if (this.rendering || !this.initialized) {
			return;
		}
		this.rendering = true;
		var startEnd = this.getStartEndMoments(false);
    	if (startEnd === undefined){
    		this.rendering = false;
    		return;
    	}
		
    	var plotDiv = this.$el.find("#plotDiv");
    	if (this.plot == undefined) {
    		this.initializePlots(startEnd.start, startEnd.end);
    		this.plot = $.plot(plotDiv, this.buildPlotDataArray(), this.plotOptions);
    		var context = this;
    		plotDiv.bind("plotclick", function (event, pos, item) {
    			context.selectData(item.dataIndex);
    			});
    		plotDiv.bind("plothover", function (event, pos, item) {
    			if (item != null){
    				context.selectData(item.dataIndex);
    			}
    			});
    		this.drawStationLabels();
    		this.drawLegendLabels();
    		$('#plot-container').resize(function(event) {context.handleResize();});
    	} else {
    		var plotOptions = this.plot.getOptions();
    		plotOptions.xaxis.timeformat = this.plotOptions.xaxis.timeformat;
    		plotOptions.colors = this.getPlotColors();
    		//Object.assign(this.plot.getOptions().xaxis, this.plotOptions.xaxis);
    		this.plot.setupGrid();
    		this.plot.setData(this.buildPlotDataArray());
    	    this.plot.draw();
    		this.drawStationLabels();
    	}
    	this.rendering = false;
	}
});

