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


$(function() {
    app.views = app.views || {};

    app.views.OLPlanView =  app.views.OLMapView.extend({
            initialize: function(options) {
                app.views.OLMapView.prototype.initialize.call(this);
                // set up tabs
                app.State.tabsContainer = $('#tabs');
                app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
            },
            
            handleResize: function() {
                app.views.OLMapView.prototype.handleResize.call(this);
                if (!_.isUndefined(app.State.tabsContainer)){
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                }
            },
            
            handleWindowResize: function() {
                // window size changed, so variables need to be reset
                if (_.isUndefined(app.tabs.currentView)) {return;}
                var shouldResize = app.views.OLMapView.prototype.handleWindowResize.call(this);
                if (shouldResize){
                    app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                }
            },
            
            buildStyles: function() {
            	olStyles.buildPlannerStyles();
            },
            
            updateBbox: function() {
                var sequence = app.currentPlan.get('sequence');
                if (_.isUndefined(sequence) || sequence.length == 0){
                 // move to bounding box defined in plan
                    var site = app.currentPlan.get('site');
                    var bbox = undefined;
                    if (!_.isUndefined(site)) {
                        bbox = site.bbox;
                    }
                    if (!_.isUndefined(bbox)) {
                        var extent = [bbox[1], bbox[0], bbox[3], bbox[2]];
                        extent = ol.extent.applyTransform(extent, ol.proj.getTransform(LONG_LAT, DEFAULT_COORD_SYSTEM));
                        this.map.getView().fit(extent, this.map.getSize(), {}); //.fit(fitExtent(extent, this.map.getSize());
                    }
                }
            },
            
            render: function() {
                app.views.OLMapView.prototype.render.call(this);
                this.drawPlan();
            },
            
            drawPlan: function() {
                if (this.planView) {
                    alert("PlanView was previously instantiated.  It's intended to be a singleton.");
                }
                
                this.planView = new PlanLayerView({
                    collection: app.currentPlan.get('sequence'),
                    map: this.map
                });
                this.planView.render();
            }
        });
    
    // This view class manages the layers that represents an entire plan.
    // On instantiation, pass in the plan sequence Backbone collection as the "collection" arguement.
    var PlanLayerView = Backbone.View
        .extend({
            initialize: function(options) {
                this.options = options || {};
                this.map = this.options.map

                this.segmentsFeatures = new ol.Collection();
                this.segmentsVector = new ol.source.Vector({features:this.segmentsFeatures});
                this.segmentsLayer = new ol.layer.Vector({name:'segments',
                    source: this.segmentsVector
                    });
                this.map.addLayer(this.segmentsLayer);
                
                this.segmentsDecorators = new ol.Collection();
                this.segmentsDecoratorsLayer = new ol.layer.Vector({name:'segmentsDecorators',
                    source:  new ol.source.Vector({features:this.segmentsDecorators})
                    });
                this.map.addLayer(this.segmentsDecoratorsLayer);
                
                
                this.stationsFeatures = new ol.Collection();
                this.stationsVector = new ol.source.Vector({features:this.stationsFeatures});
                this.stationsLayer = new ol.layer.Vector({name:'stations',
                    source: this.stationsVector,
                    zIndex: 2
                    });
                this.map.addLayer(this.stationsLayer);
                this.stationsDecorators = new ol.Collection();
                this.stationsDecoratorsLayer = new ol.layer.Vector({name:'stationsDecorators',
                    source:  new ol.source.Vector({features:this.stationsDecorators})
                    });
                this.map.addLayer(this.stationsDecoratorsLayer);

                app.vent.on('mapmode', this.setMode, this);
                app.vent.trigger('mapmode', 'navigate');
                
                this.collection.resequence(); // Sometimes it doesn't resequence itself on load
                this.listenTo(app.currentPlan, 'sync', this.render, this);

                app.State.planLoaded = true;
            },
            createVehicle: function() {
            	if (this.vehicleView === undefined){
            		if (this.stationsFeatures.getLength() > 0){
	            		var vehicleJson = {name:app.currentPlan.get('platform').name,
	                                       startPoint:this.getFirstStationCoords()};
	            		this.vehicleView = new app.views.OLVehicleView({featureJson:vehicleJson});
	            		this.map.addLayer(this.vehicleView.vectorLayer);
            		}
            	}
            },
            clear: function() {
        	
            },
            render: function() {
        	var redraw = false;
        	if (this.stationsFeatures.getLength() > 0){
        	    redraw = true;
        	    this.segmentsVector.clear();
        	    this.segmentsFeatures.clear();
        	    this.segmentsDecorators.clear();
        	    this.segmentsDecoratorsLayer.getSource().clear();
        	    
        	    this.stationsVector.clear();
        	    this.stationsFeatures.clear();
        	    this.stationsDecorators.clear();
        	    this.stationsDecoratorsLayer.getSource().clear();
        	}
        	
                if (this.currentMode) {
                    this.resetMode();
                }
        	
                this.drawStations();
                this.drawSegments();
                
                if (!redraw){
                    // scale map to focus on plan
                    if (!_.isEmpty(this.segmentsVector.getFeatures())){
                	this.map.getView().fit(this.segmentsVector.getExtent(), this.map.getSize(), {}); 
                    }
                }
                
                this.createVehicle();

            },

            drawStation: function(station) {
                var stationPointView = new app.views.StationPointView({
                    model: station,
                    stationsVector: this.stationsVector,
                    stationsDecoratorsVector: this.stationsDecoratorsLayer.getSource()
                });

                return stationPointView;
            },

            drawStations: function() {
                this.stationViews = [];
                _.each(this.collection.filter(function(model) {
                    return model.get('type') == 'Station';
                }), function(station) {
                    this.stationViews.push(this.drawStation(station));
                }, this // view context
                      );

//                _.each(this.stationViews, function(stationView) {
//                    stationView.addPolygons();
//                });
            },

            drawSegment: function(segment, fromStation, toStation) {
                var segmentLineView = new app.views.SegmentLineView({
                    model: segment,
                    fromStation: fromStation,
                    toStation: toStation,
                    segmentsVector: this.segmentsVector,
                    segmentsDecoratorsVector: this.segmentsDecoratorsLayer.getSource(),
                    planLayerView: this
                });
                return segmentLineView;
            },

            drawSegments: function() {
                this.collection.each(function(item, index, list) {
                    if (item.get('type') == 'Segment') {
                        var fromStation = list[index - 1];
                        var toStation = list[index + 1];
                        var drawnSegment = this.drawSegment(item, fromStation, toStation);
                    }
                }, this);

            },
            setMode: function(modeName) {
                var modeMap = {
                    'addStations' : 'addStationsMode',
                    'navigate' : 'navigateMode',
                    'reposition' : 'repositionMode'
                };

                if (this.currentMode) {
                    this.currentMode.exit.call(this);
                }
                var mode = _.isObject(modeName) ? modeName : this[modeMap[modeName]];
                mode.enter.call(this);
                this.currentMode = mode;
                this.currentModeName = modeName;
            },

            // Clean up, then re-enter the mode.  Useful for re-draws/
            resetMode: function() {
                if (this.currentMode) {
                    var mode = this.currentMode;
                    mode.exit.call(this);
                    mode.enter.call(this);
                }
            },

            getFirstStationCoords: function() {
                var startStation = this.collection.at(0);
                if (!_.isUndefined(startStation)) {
                    return transform(startStation.get('geometry').coordinates);
                }
                return undefined;
            },
            
            getLastStationCoords: function() {
                var endStation = this.collection.at(this.collection.length - 1);
                if (!_.isUndefined(endStation)) {
                    return transform(endStation.get('geometry').coordinates);
                }
                return undefined;
            },
            
            addStationsMode: {
                enter: function() {
                    app.State.popupsEnabled = false;
                    app.State.disableAddStation = false; // reset state possibly set in other mode
                    if (_.isUndefined(this.stationAdder)){
                        this.stationAdder = new ol.interaction.Draw({
                            features: new ol.Collection(),
                            type: "Point",
                            name: "drawInteraction"
                        }, this);
                        this.stationAdder.on('drawend', function(event) {
                            var geometry = event.feature.getGeometry();
                            var coords = inverseTransform(geometry.getCoordinates());
                            var station = app.models.stationFactory({
                                coordinates: coords
                            });
                            var sequence = app.currentPlan.get('sequence');
                            var newSegment = sequence.appendStation(station); // returns a segment if one was created

                            var stationPointView = this.drawStation(station);
                            this.stationViews.push(stationPointView);

                            if (!_.isUndefined(newSegment)) {
                                var segIndex = sequence.indexOf(newSegment);
                                this.drawSegment(newSegment, sequence.at(segIndex - 1), station);
                            }

                            // set time and location for added station
                            app.State.addStationLocation = coords;
                            app.State.addStationTime = Date.now();
                        }, this);
                    }
                    this.stationAdder.setActive(true);
                    this.map.addInteraction(this.stationAdder);
                },
                exit: function() {
                    this.stationAdder.setActive(false);
                    this.map.removeInteraction(this.stationAdder);
                }
            }, // end addStationMode
            
            navigateMode: {
                enter: function() {
                    app.State.popupsEnabled = true;
                    if (_.isUndefined(this.selectNavigate)){
                        var _this = this;
                        this.selectNavigate = new ol.interaction.Select({
                            condition: ol.events.condition.click,
                            multi: false,
                            name: "selectNavigate",
                            layers: [_this.segmentsLayer, _this.stationsLayer]
                        });
                        
                        this.selectNavigate.getFeatures().on('add', function(e) {
                            var feature = e.element;
                            var model = feature.get('model');
                            switch (model.get('type')) {
                                case 'Station':
                                    app.State.stationSelected = feature.get('model');
                                    app.State.segmentSelected = undefined;
                                    feature.changed();
                                    break;
                                case 'Segment':
                                    app.State.segmentSelected = feature.get('model');
                                    app.State.stationSelected = undefined;
                                    feature.changed();
                                    break;
                            }
                            
                            app.State.metaExpanded = true;
                            app.State.addCommandsExpanded = false;
                            app.State.commandSelected = undefined;
                            if (app.currentTab != 'sequence') {
                                app.vent.trigger('setTabRequested','sequence');
                            } else {
                                app.tabs.currentView.tabContent.currentView.render();
                            }
                        });
                        this.selectNavigate.getFeatures().on('remove', function(e) {
                            var feature = e.element;
                            feature.changed();
                        });
                        this.listenTo(app.vent, 'itemSelected:station', function() {
                            var selectedItem = app.State.stationSelected;
                            this.mapSelect(selectedItem);
                        });
                        
                        this.listenTo(app.vent, 'itemSelected:segment', function() {
                            var selectedItem = app.State.segmentSelected;
                            this.mapSelect(selectedItem);
                        });
                        
                        
                    };
                    this.selectNavigate.setActive(true);
                    this.map.addInteraction(this.selectNavigate);
                    
                },
                exit: function() {
                    this.selectNavigate.getFeatures().clear();
                    this.selectNavigate.setActive(false);
                    this.map.removeInteraction(this.selectNavigate);
                }
            },
            
            mapSelect: function(selectedItem){
            	var snav = this.selectNavigate;
                var features = this.selectNavigate.getFeatures();

                if (!_.isUndefined(selectedItem)){
                    var foundFeature = selectedItem['feature'];
                    if (features.getLength() > 0){
                        if (features.item(0) == foundFeature) {
                            return;
                        } else {
                            // we are only doing single selection so this should be fine
                            features.removeAt(0);
                        }
                    }
                    
                    features.push(foundFeature);
                    this.selectNavigate.changed();
                    
                }  else {
                    features.removeAt(0);
                    this.selectNavigate.changed();
                }
            },
            
            deleteStation: function(e) {
        	var feature = e.element;
                var model = feature.get('model');
                if (!_.isUndefined(model)){
                	if (model.get('type') == 'Station'){
                	    // delete the station
                	    var killedSegment = this.collection.removeStation(model);
                	}
                }
            },
            
            activateStationRepositioner: function() {
        	this.stationRepositioner.setActive(true);
        	this.stationDeleter.setActive(true);
        	this.map.addInteraction(this.stationRepositioner);
        	this.map.addInteraction(this.stationDeleter);
        	this.stationDeleter.getFeatures().clear();
        	this.stationDeleter.getFeatures().on('add', this.deleteStation, this);
            },
            
            deactivateStationRepositioner: function() {
        	this.map.removeInteraction(this.stationRepositioner);
        	this.map.removeInteraction(this.stationDeleter);
        	this.stationRepositioner.setActive(false);
        	this.stationDeleter.setActive(false);
        	this.stationDeleter.getFeatures().un('add', this.deleteStation, this);
            },
            
            repositionMode: {
                enter: function() {
                    app.State.popupsEnabled = false;
                    
                    if (_.isUndefined(this.stationRepositioner)){
                	this.stationRepositioner = new ol.interaction.Modify({
                        	name: "stationRepositioner",
                        	features: this.stationsFeatures
                        });
                	this.stationRepositioner.on('modifystart', function(event){
                            app.Actions.disable();
                        }, this);
                	this.stationRepositioner.on('modifyend', function(event){
                            app.Actions.enable();
                            app.Actions.action();
                        }, this);
                        this.segmentModifier = new ol.interaction.Modify({
                        	name: "segmentModifier",
                        	features: this.segmentsFeatures
                        });
                        this.segmentModifier.on('modifyend', function(event){
                            event.features.forEach(function(element, index, array) {
                        	var geom = element.getGeometry();
                        	var coords = geom.getCoordinates();
                        	if (coords.length > 2){
                        	    var model = element.get('model')
                        	    model.trigger('splitSegment');
                        	}
                            }, this);
                    	
                        }, this);
                        this.stationDeleter = new ol.interaction.Select({
                        	name: "stationDeleter",
                        	layers: [this.stationsLayer],
                        	condition: function(event){
                        	    return ol.events.condition.shiftKeyOnly(event)
                        	    && ol.events.condition.singleClick(event);
                        	}
                            });
                        
                        
                        this.listenTo(app.vent, 'station:remove', function(killedStation) {
                            if (!_.isUndefined(killedStation)){
                                var feature = killedStation.feature;
                                if (!_.isUndefined(feature)){
                                    this.stationDeleter.getFeatures().clear();
                                }
                            }
                        }, this);
                        app.vent.on('deactivateStationRepositioner', this.deactivateStationRepositioner, this);
                	app.vent.on('activateStationRepositioner', this.activateStationRepositioner, this);
                    } 
                    
                    this.segmentModifier.setActive(true);
                    this.map.addInteraction(this.segmentModifier);
                    this.activateStationRepositioner();
                }, // end enter
                exit: function() {
                	  this.stationRepositioner.setActive(false);
                	  this.segmentModifier.setActive(false);
                	  this.stationDeleter.getFeatures().clear();
                	  this.map.removeInteraction(this.stationRepositioner);
                	  this.map.removeInteraction(this.segmentModifier);
                	  this.map.removeInteraction(this.stationDeleter);
                }
            } // end repositionMode

        });
    
});
