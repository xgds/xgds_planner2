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
		UpdatePlanDuration: 0,
		ModifyEnd: 1,
		Save: 2
}

BLANKS = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

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
	   	'update': UPDATE_ON.UpdatePlanDuration
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
		'update': UPDATE_ON.ModifyEnd
	},
	initialize: function(startMoment, endMoment) {
		this.initializeDataTileView();
		app.vent.on('dataTileLoaded', function(url){
			if (url == this.get('dataFileUrl')){
				app.vent.trigger('drawPlot',this.get('name'));
			}
		}, this);
	},
	
	loadDataSource: function() {
		// force load of data source
		
	},
	
	initializeDataTileView: function() {
		if (this.dataTileView === undefined && app.dataTile !== undefined){
			this.dataTileView = app.dataTile[this.get('dataFileUrl')];
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
		var range = this.get('maxValue') - this.get('minValue');
		var nowMoment = startMoment.clone();
		while (nowMoment.isBefore(endMoment)){
			var theTime = nowMoment.toDate().getTime();
			var position = coordinates[theTime];
			var value = this.dataTileView.getRawDataValue(position);
			rawResult.push([theTime, value]);
			// convert to percentage
			var percentValue = null;
			if (value != null) {
				percentValue = 100.0 * (value/range);
			}
			result.push([theTime, percentValue]);
			nowMoment = nowMoment.add(intervalSeconds, 's');
		}
		return result;
	}
})

app.views.PlanPlotView = Backbone.Marionette.ItemView.extend({
	el: '#plot-container',
	template: false,
	plotLabels : {},
	dataPlots: {},
	plotDataCache: {},
	intervalSeconds: 5,
	needsCoordinates: false,
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
        }
    },
    getTickSize: function(durationSeconds) {
    	if (durationSeconds > 12){
    		var twelfth = moment.duration(durationSeconds/12, 'seconds');
    		this.intervalSeconds = twelfth.asSeconds()/40;
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
    	return [1, 'minute'];
    },
    getXAxisOptions: function() {
    	var durationSeconds = app.currentPlan._simInfo.deltaTimeSeconds;
    	var mduration = moment.duration(durationSeconds, 'seconds');
    	var tickSize = this.getTickSize(durationSeconds);
    	var timeformat = '%H:%M';
    	if (tickSize[1] == 'day'){
    		timeformat = '%m/%d';
    	} else if (mduration.hours() > 12){
    		timeformat = '%m/%d %H:%M';
    	}
    	return { mode: 'time',
			  	tickSize: tickSize,
			  	timeformat: timeformat,
			  	timezone: app.getTimeZone(),
			  	reserveSpace: false
				 };
    },
	initialize: function() {
		var context = this;
		this.constructPlotDataModels();
		this.needsCoordinates = this.calculateNeedsCoordinates();
		this.lastDataIndex = -1;
		this.lastDataIndexTime = -1;
		this.plotOptions['grid']['markings'] = function() { return context.getStationMarkings()};
		this.plotOptions['xaxis'] = context.getXAxisOptions(); 
		this.plotColors = this.getPlotColors();
		this.plotOptions['colors'] = context.plotColors;
		this.getStartEndMoments(true);
		this.listenTo(app.vent, 'updatePlanDuration', function(model) {this.updatePlots(UPDATE_ON.UpdatePlanDuration)});
		this.listenTo(app.vent, 'modifyEnd', function(model) {this.updatePlots(UPDATE_ON.ModifyEnd)});
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
		app.currentPlan.get('sequence').on('remove', function(model){this.render()}, this);
		playback.addListener(playback.plot);
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
	
    getStationMarkings: function() {
    	if (app.currentPlan._simInfo === undefined){
    		app.simulatePlan();
    		this.getStartEndMoments(true);
    	}
    	var result = [];
    	for (var i=0; i<this.startEndTimes.length; i++){
    		result.push({xaxis: {from:this.startEndTimes[i].start.toDate().getTime(),
    							 to: this.startEndTimes[i].end.toDate().getTime()},
    							 color:'#FFA500'});
    	}
    	return result;
    },
    drawLegendLabels: function() {
    	var keys = Object.keys(this.dataPlots);
    	for (var i=0; i<keys.length; i++) {
    		var label=keys[i];
    		var underLabel = label.replace(' ','_');
    		var theColor = this.dataPlots[label].getLineColor();
    		var content = '<div id="' + underLabel + 'legend_div" style="display:inline-block; min-width: 120px;"><span id="' + underLabel + '_label" style="color:' + theColor + '">' + label + ':</span><span id="' + underLabel + '_value">' + BLANKS + '</span></div>';
    		$("#plotLegend").append(content);
    	}
    },
    drawStationLabels: function() {
    	// draw labels
		var context = this;
		var index = 0;
		var sequence = app.currentPlan.get('sequence');
		var saveUs = [];
		var deathRow = []
		sequence.each(function(pathElement, i, sequence) {
    		if (pathElement.attributes.type == 'Station'){
    			startEndTime = this.startEndTimes[index];
    			o = context.plot.pointOffset({ x: startEndTime.start.toDate().getTime(), y: 0 });
    			if (pathElement.attributes.uuid in context.plotLabels){
    				context.plotLabels[pathElement.attributes.uuid].text(pathElement._sequenceLabel);
    				context.plotLabels[pathElement.attributes.uuid].css({top: (o.top - 20), left: (o.left + 4), position:'absolute'});
    			} else {
    				var el = $("<div id='plotLabel_" + pathElement.attributes.uuid + "' style='position:absolute;left:" + (o.left + 4) + "px;top:" + (o.top - 20) + "px;color:#FF4500;font-weight:bold;'>" + pathElement._sequenceLabel + "</div>");
    				el.appendTo(plotDiv);
    				context.plotLabels[pathElement.attributes.uuid] = el;
    			}
        		saveUs.push(pathElement.attributes.uuid);
    			index++;
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
    		result.push(plotModel.get('lineColor'));
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
    	playback.vehicleDriver.initialize();
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
    		stationData.push([this.startEndTimes[i].start.toDate().getTime(), 0]);
    		stationData.push([this.startEndTimes[i].end.toDate().getTime(), 0]);
    		stationData.push(null);
    	}
    	return [stationData];
    },
    cachePlotData: function(startMoment, endMoment, eventType){
    	var context = this;
    	var coordinates = undefined;
    	if (this.needsCoordinates){
    		coordinates = this.getCoordinates(startMoment, endMoment);
    	}
    	$.each( this.dataPlots, function(key,plotModel){
    		if (eventType == plotModel.get('update') || !(key in context.plotDataCache)) {
    			var dataValues = plotModel.getDataValues(startMoment, 
    												 	endMoment,
    												 	context.intervalSeconds,
    												 	coordinates);
    			if (!_.isEmpty(dataValues)) {
    				context.plotDataCache[key] = dataValues;
    			}
    		}
    	});
    },
    getPlotDataFromCache: function() {
    	var result = [];
    	var context = this;
    	$.each( this.dataPlots, function(key,plotModel){
    		if (key in context.plotDataCache){
	    		var data = context.plotDataCache[key];
	    		if (data != undefined && !_.isEmpty(data)){
	    			result.push({'label': key,
		 			 		 	'data': data});
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
    updatePlot: function(key) {
    	var plotModel = this.dataPlots[key];
    	var startEnd = this.getStartEndMoments(false);
    	if (startEnd === undefined){
    		return;
    	}
    	var coordinates = undefined;
    	if (this.needsCoordinates){
    		coordinates = this.getCoordinates(startEnd.start, startEnd.end);
    	}
    	var dataValues = plotModel.getDataValues(startEnd.start, 
    											 startEnd.end,
    											 this.intervalSeconds,
    											 coordinates);
    	if (!_.isEmpty(dataValues)) {
    		this.plotDataCache[key] = dataValues;
    	}
    	this.render();
    },
    updatePlots: function(eventType) {
    	var startEnd = this.getStartEndMoments(true);
    	if (startEnd === undefined){
    		return;
    	}
    	this.cachePlotData(startEnd.start, startEnd.end, eventType);
    	this.render();
    },
    selectData: function(index) {
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
					if (time == null){
						time = dataAtIndex[0];
						value = dataAtIndex[1];
					} else if (time == dataAtIndex[0]) {
						value = dataAtIndex[1];
					}
				}
				
				//TODO trigger event to draw it below plot
				this.updateDataValue(label, value);
			}
			label = undefined;
		}
		this.updateTimeValue(time);
    },
    updateDataValue(label, value){
    	// show the value from the plot below the plot.
    	var labelValue = ('#' + label + '_value').replace(' ','_');
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
	onRender: function() {
		
		var startEnd = this.getStartEndMoments(false);
    	if (startEnd === undefined){
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
    		$('#plot-container').resize(function() {
    			context.drawStationLabels();
    		});
    	} else {
    		this.plot.setupGrid();
    		this.plot.setData(this.buildPlotDataArray());
    	    this.plot.draw();
    		this.drawStationLabels();
    	}
		 
	}
});

