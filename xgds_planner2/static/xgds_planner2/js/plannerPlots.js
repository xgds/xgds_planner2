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

var PlotDataModel = Backbone.Model.extend({
	defaults: {
		'lineColor':     'blue',
		'usesPosition':    false
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
		'usesPosition':    true
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
		var loaded = this.initializeDataTileView();
		if (!loaded){
			return result;
		}
		var nowMoment = startMoment.clone();
		while (nowMoment.isBefore(endMoment)){
			var theTime = nowMoment.toDate().getTime();
			var position = coordinates[theTime];
			var value = this.dataTileView.getDataValue(position);
			result.push([theTime, parseFloat(value)]);
			nowMoment = nowMoment.add(intervalSeconds, 's');
		}
		//console.log(result);
		return result;
	}
})

app.views.PlanPlotView = Backbone.Marionette.ItemView.extend({
	el: '#plot-container',
	template: false,
	plotLabels : {},
	dataPlots: {},
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
    	} else {
    		this.intervalSeconds = 5;
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
		//this.plotColors = this.getPlotColors();
		this.plotOptions['grid']['markings'] = context.getStationMarkings;
		this.plotOptions['xaxis'] = context.getXAxisOptions(); 
		//this.plotOptions['colors'] = context.plotColors;
		this.startEndTimes = app.getStationStartEndTimes();
		this.listenTo(app.vent, 'updatePlanDuration', function(model) {this.render()});
		this.listenTo(app.vent, 'drawPlot', function(key) {this.render()}); //TODO just render the specific plot
		app.currentPlan.get('sequence').on('remove', function(model){this.render()}, this);
		$('#plot-container').resize(function() {
			context.drawStationLabels();
		});
	},
	
    getStationMarkings: function() {
    	if (app.currentPlan._simInfo === undefined){
    		app.simulatePlan();
    	}
    	var result = [];
    	this.startEndTimes = app.getStationStartEndTimes();
    	for (var i=0; i<startEndTimes.length; i++){
    		result.push({xaxis: {from:this.startEndTimes[i].start.toDate().getTime(),
    							 to: this.startEndTimes[i].end.toDate().getTime()},
    							 color:'#FFA500'});
    	}
    	return result;
    },
    drawStationLabels: function(startEndTimes) {
    	// draw labels
    	if (startEndTimes === undefined){
    		startEndTimes = this.startEndTimes;
    	}
		var context = this;
		var index = 0;
		var sequence = app.currentPlan.get('sequence');
		var saveUs = [];
		var deathRow = []
		sequence.each(function(pathElement, i, sequence) {
    		if (pathElement.attributes.type == 'Station'){
    			startEndTime = startEndTimes[index];
    			o = context.plot.pointOffset({ x: startEndTime.start.toDate().getTime(), y: 0 });
    			if (pathElement.attributes.uuid in context.plotLabels){
    				context.plotLabels[pathElement.attributes.uuid].text(pathElement._sequenceLabel);
    				context.plotLabels[pathElement.attributes.uuid].css({top: (o.top - 20), left: (o.left + 4), position:'absolute'});
    			} else {
    				var el = $("<div id='plotLabel_" + pathElement.attributes.uuid + "' style='position:absolute;left:" + (o.left + 4) + "px;top:" + (o.top - 20) + "px;color:#FF4500;font-size:smaller;font-weight:bold;'>" + pathElement._sequenceLabel + "</div>");
    				el.appendTo(plotDiv);
    				context.plotLabels[pathElement.attributes.uuid] = el;
    			}
        		saveUs.push(pathElement.attributes.uuid);
    			index++;
    		}
		});
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
    getPlotData: function(startMoment, endMoment){
    	var context = this;
    	var result = [];
    	var coordinates = undefined;
    	if (this.needsCoordinates){
    		coordinates = this.getCoordinates(startMoment, endMoment);
    	}
    	$.each( this.dataPlots, function(key,plotModel){
    		var dataValues = plotModel.getDataValues(startMoment, 
    												 endMoment,
    												 context.intervalSeconds,
    												 coordinates);
    		if (!_.isEmpty(dataValues)) {
    			result.push({'label': key,
    					 	 'data': dataValues});
    		}
    		
    		});
    	return result;
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
    buildPlotDataArray: function() {
    	var plotData = this.getPlotData(this.startEndTimes[0].start, this.startEndTimes[this.startEndTimes.length - 1].end, this.intervalSeconds);
		if (_.isEmpty(plotData)){
			plotData = this.getStationData();
		} else {
			plotData.push({data:this.getStationData()[0]});
		}
		return plotData;
    },
	onRender: function() {
		
    	this.startEndTimes = app.getStationStartEndTimes();
    	if (_.isEmpty(this.startEndTimes)){
    		return;
    	}
		
    	var plotDiv = this.$el.find("#plotDiv");
    	if (this.plot == undefined) {
    		this.initializePlots(this.startEndTimes[0].start, this.startEndTimes[this.startEndTimes.length - 1].end);
    		this.plot = $.plot(plotDiv, this.buildPlotDataArray(), this.plotOptions);
    		this.drawStationLabels(this.startEndTimes);
    	} else {
    		this.plot.setupGrid();
    		this.plot.setData(this.buildPlotDataArray());
    	    this.plot.draw();
    		this.drawStationLabels(this.startEndTimes);
    	}
		 
	}
});
