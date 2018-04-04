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

var DEBUG_SEGMENTS = false;  // Turn on labels for segments


$(function() {
    app.views = app.views || {};    
    
    app.views.SegmentLineView = Marionette.View.extend({
    	template: false,
        initialize: function(options) {
            this.options = options || {};
            var options = this.options;
            if (!options.segmentsVector || !options.toStation || !options.fromStation) {
                throw 'Missing a required option!';
            }
            this.segmentsVector = this.options.segmentsVector;
            this.planLayerView = this.options.planLayerView;
            this.fromStation = this.options.fromStation;
            this.toStation = this.options.toStation;
            this.otherStation = {};
            this.otherStation[this.toStation.cid] = this.fromStation;
            this.otherStation[this.fromStation.cid] = this.toStation;
            this.addChangeListener(this.fromStation);
            this.addChangeListener(this.toStation);
            this.splittingGeometry = false;
            this.model.on('alter:stations', function() {
                this.updateStations();
                this.updateGeometry();
            }, this);
            this.model.on('segment:remove', function() {
                if (!_.isUndefined(this.feature)){
                    this.removeChangeListener(this.fromStation);
                    this.removeChangeListener(this.toStation);
                    this.segmentsVector.removeFeature(this.feature);
                }
            }, this);
            this.initTextStyle();
            this.render();
        },
        
        updateStations: function() {
            // make sure we have the correct from and to stations.
            var segmentIndex = this.planLayerView.collection.indexOf(this.model);
            if (segmentIndex < 1){
                return;
            }
            var newFromStation = this.planLayerView.collection.at(segmentIndex - 1);
            var newToStation = this.planLayerView.collection.at(segmentIndex + 1);
            var changed = false;
            
            if (newFromStation != this.fromStation){
                this.removeChangeListener(this.fromStation);
                this.fromStation = newFromStation;
                this.addChangeListener(this.fromStation);
                changed = true;
            }
            
            if (newToStation != this.toStation){
                this.removeChangeListener(this.toStation);
                this.toStation = newToStation;
                this.addChangeListener(this.toStation);
                changed = true;
            }
            if (changed){
                this.otherStation[this.toStation.cid] = this.fromStation;
                this.otherStation[this.fromStation.cid] = this.toStation;
                // for debugging
                if (DEBUG_SEGMENTS){
                    var newLabel = this.getLabel();
                    if (!_.isEqual(newLabel, this.textStyle.getText().getText())){
                    	this.textStyle.getText().setText(newLabel);
                    }
                }
            }
        },
        
        removeChangeListener: function(station){
            this.stopListening(station, 'change:geometry');
        },
        addChangeListener: function(station) {
            this.listenTo(station, 'change:geometry', this.updateGeometry);
        },
        getSegmentStyles: function(feature, resolution){
        	result = [];
        	var model = this.model;
        	
        	if (_.isUndefined(model)){
        		// this is the feature
        		model = this.get('model');
        	}
        	var result;
        	if (app.State.segmentSelected === model){
        		result = [olStyles.styles['selectedSegment']];
        	} else {
        		result = [olStyles.styles['segment']];
        	}
        	if (DEBUG_SEGMENTS){
        		var textStyle = this.textStyle;
        		if (_.isUndefined(textStyle)){
        			textStyle = this.get('textStyle');
        		}
        		result.push(textStyle);
        	}
        	return result;
        },
        updateCoords: function() {
        	this.coords = _.map([this.fromStation, this.toStation],
        			function(station) {
        				return transform(station.get('geometry').coordinates);
        	});
        },
        onRender: function() {
            this.updateCoords();
            this.geometry = new ol.geom.LineString(this.coords, 'XY');
            this.feature = new ol.Feature({geometry: this.geometry,
                                           id: this.fromStation.attributes['id'],
                                           name: this.fromStation.attributes['id'],
                                           model: this.model
                                                 });
            var context = this;
            this.feature.setStyle(function(feature, resolution) {return context.getSegmentStyles(feature, resolution);});
            this.feature.set('textStyle', context.textStyle);
            
            this.listenTo(this.model, 'splitSegment', this.handleSplitSegment, this);
            this.model['feature'] = this.feature;
            this.segmentsVector.addFeature(this.feature);
        },
        
        handleSplitSegment: function(event) {
        	if (this.splittingGeometry){
        		return;
        	}

        	var geometry = this.feature.getGeometry(); //event.target;
        	var newCoordinates = geometry.getCoordinates();
        	if (newCoordinates.length > 2) {
        		this.segmentsVector.removeFeature(this.feature);

        		// disable undo/redo action recording
        		app.Actions.disable();
        		app.vent.trigger('deactivateStationRepositioner');
        		this.splittingGeometry = true;
        		this.stopListening(this.model, 'splitSegment');

        		var oldSegment = this.model; 
        		var oldFirstStation = this.fromStation;
        		var newStation = app.models.stationFactory({
        			coordinates: inverseTransform(newCoordinates[1])
        		});

        		var segmentBefore = this.planLayerView.collection.insertStation(oldSegment, newStation);
        		var stationPointView = this.planLayerView.drawStation(newStation);
        		this.planLayerView.stationViews.push(stationPointView);

        		if (!_.isUndefined(segmentBefore)){
        			this.planLayerView.drawSegment(segmentBefore, oldFirstStation, newStation);
        		}

        		//total hack, remove and readd this segment to the feature
        		// this will prevent continuing to edit the second point of the segment (ie the one we just added)
        		this.segmentsVector.addFeature(this.feature);

        		app.vent.trigger('activateStationRepositioner');
        		this.splittingGeometry = false;
        		this.listenTo(this.model, 'splitSegment', this.handleSplitSegment, this);
        		app.Actions.enable();
        		app.Actions.action();

        	}

        },
        /*
         ** Update the endpoints of the segment when either adjacent station changes.
         */
         updateGeometry: function() {
             if (!_.isUndefined(this.fromStation) && !_.isUndefined(this.toStation) && !_.isUndefined(this.geometry)){
                 this.updateCoords();
                 this.geometry.setCoordinates(this.coords);
             }
         },
         
         // for debugging put a label on the segment
         getLabel: function() {
             var sequence = app.currentPlan.get('sequence');
             var segIndex = sequence.indexOf(this.model);
             var name = this.model.id + ' ' + segIndex + '(' + sequence.indexOf(this.fromStation) + ',' + sequence.indexOf(this.toStation) + ')';
             return name;
         },
         
         initTextStyle: function() {
             if (DEBUG_SEGMENTS){
                 var name = this.getLabel();
                 var theText = new ol.style.Text(olStyles.styles['segmentText']);
                 theText.setText(name);
                 this.textStyle = new ol.style.Style({
                     text: theText 
                 });
             }
         }
    });
});
