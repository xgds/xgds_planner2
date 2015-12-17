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
            
            buildStyles: function() {
                app.views.OLMapView.prototype.buildStyles.call(this);
                if (_.isUndefined(app.styles)){
                    app.styles = new Object();
                }
                app.styles['segment'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'yellow',
                        width: app.options.planLineWidthPixels
                      })
                    });
                app.styles['selectedSegment'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'cyan',
                        width: app.options.planLineWidthPixels + 2
                      })
                    });
                app.styles['placemarkImage'] = new ol.style.Icon({
                    src: app.options.placemarkCircleUrl,
                    scale: .8,
                    rotateWithView: false,
                    opacity: 1.0
                    });
                app.styles['station'] = new ol.style.Style({
                    image: app.styles['placemarkImage']
                    });
                app.styles['selectedPlacemarkImage'] = new ol.style.Icon({
                    src: app.options.placemarkCircleHighlightedUrl,
                    scale: 1.2
                    });
                app.styles['selectedStation'] = new ol.style.Style({
                    image: app.styles['selectedPlacemarkImage']
                    });
                app.styles['direction'] = {
                        src: app.options.placemarkDirectionalUrl,
                        scale: 0.85,
                        rotation: 0.0,
                        rotateWithView: true
                        };
                app.styles['selectedDirection'] = {
                        src: app.options.placemarkSelectedDirectionalUrl,
                        scale: 1.2,
                        rotation: 0.0,
                        rotateWithView: true
                        };
                
                app.styles['stationText'] = {
                        font: '16px Calibri,sans-serif,bold',
                        fill: new ol.style.Fill({
                            color: 'yellow'
                        }),
                        stroke: new ol.style.Stroke({
                            color: 'black',
                            width: 2
                        }),
                        offsetY: -20
                };
                app.styles['segmentText'] = {
                        font: '14px Calibri,sans-serif',
                        stroke: new ol.style.Stroke({
                            color: 'red',
                            width: 1
                        })
                    };
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
                this.stationsFeatures = new ol.Collection();

                this.segmentsVector = new ol.source.Vector({features:this.segmentsFeatures});
                this.stationsVector = new ol.source.Vector({features:this.stationsFeatures});
                this.segmentsLayer = new ol.layer.Vector({name:'segments',
                    source: this.segmentsVector,
                    style: (function() {
                      return function(feature, resolution) {
                  	return feature.getStyle();
                      };
                    })()
                    });

                this.stationsLayer = new ol.layer.Vector({name:'stations',
                    source: this.stationsVector,
                    zIndex: 2,
                    style: (function() {
                        return function(feature, resolution) {
                    	return feature.getStyle();
                        };
                      })()
                    });
                this.map.addLayer(this.segmentsLayer);
                this.map.addLayer(this.stationsLayer);


                app.vent.on('mapmode', this.setMode, this);
                app.vent.trigger('mapmode', 'navigate');
                
                this.collection.resequence(); // Sometimes it doesn't resequence itself on load
                this.listenTo(app.currentPlan, 'sync', this.render, this);

                app.State.planLoaded = true;
            },
            clear: function() {
        	
            },
            render: function() {
        	var redraw = false;
        	if (this.stationsFeatures.getLength() > 0){
        	    redraw = true;
        	    this.segmentsVector.clear();
        	    this.segmentsFeatures.clear();
        	    this.stationsVector.clear();
        	    this.stationsFeatures.clear();
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

            },

            drawStation: function(station) {
                var stationPointView = new StationPointView({
                    model: station,
                    stationsVector: this.stationsVector
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
                var segmentLineView = new SegmentLineView({
                    model: segment,
                    fromStation: fromStation,
                    toStation: toStation,
                    segmentsVector: this.segmentsVector,
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
                                    var selectedStyles = feature.get('selectedStyles');
                                    feature.setStyle(selectedStyles);
                                    break;
                                case 'Segment':
                                    app.State.segmentSelected = feature.get('model');
                                    app.State.stationSelected = undefined;
                                    var selectedStyles = feature.get('selectedStyles');
                                    feature.setStyle(selectedStyles);
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
                            var styles = feature.get('styles');
                            feature.setStyle(styles);
                        });
                        this.listenTo(app.vent, 'itemSelected:station', function() {
                            var selectedItem = app.State.stationSelected;
                            this.mapSelect(selectedItem);
                        });
                        
                        this.listenTo(app.vent, 'itemSelected:segment', function() {
                            var selectedItem = app.State.stationSelected;
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
//                        	addCondition: function(event) {
//                        	    return ol.events.condition.shiftKeyOnly(event)
//                        	    && ol.events.condition.singleClick(event);
//                        	},
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
    
    var SegmentLineView = Backbone.View.extend({
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
                    if (!_.isEqual(this.getLabel(), this.textStyle.getText().getText())){
                        delete this.textStyle; // for garbage collection
                        this.feature.setStyle(this.getStyles());
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
        getStyles: function() {
            if (DEBUG_SEGMENTS){
                this.initTextStyle();
                return [app.styles['segment'], this.textStyle]
            } else {
                return [app.styles['segment']];
            }
        },
        getSelectedStyles: function() {
            if (DEBUG_SEGMENTS){
                this.initTextStyle();
                return [app.styles['selectedSegment'], this.textStyle]
            } else {
                return [app.styles['selectedSegment']];
            }
        },
        render: function() {
            this.coords = _.map([this.fromStation, this.toStation],
                               function(station) {
                                   return transform(station.get('geometry').coordinates);
                               });

            this.geometry = new ol.geom.LineString([this.coords[0], this.coords[1]], 'XY');
            this.feature = new ol.Feature({geometry: this.geometry,
                                           id: this.fromStation.attributes['id'],
                                           name: this.fromStation.attributes['id'],
                                           model: this.model
//                                                 'styles': this.getStyles(),
//                                                 'selectedStyles': this.getSelectedStyles()
                                                 });
            this.feature.set('selectedStyles', this.getSelectedStyles());
            this.feature.set('styles', this.getStyles());
            
            // for some reason you have to set the style this way
            this.feature.setStyle(this.getStyles());
            
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
                
        	// disable everything
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
                 this.coords = _.map([this.fromStation, this.toStation],
                         function(station) {
                             return transform(station.get('geometry').coordinates);
                         });
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
                 var theText = new ol.style.Text(app.styles['segmentText']);
                 theText.setText(name);
                 this.textStyle = new ol.style.Style({
                     text: theText 
                 });
             }
         }
    });
    
 // This view class manages the map point for a single Station model
    var StationPointView = Backbone.View
        .extend({
            initialize: function(options) {
                this.options = options || {};
                this.stationsVector = this.options.stationsVector;
                
                if (!options.stationsVector && !options.model) {
                    throw 'Missing a required option!';
                }

                var pmOptions = {};
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                pmOptions.name = name || this.model.toString();
                this.point = transform(this.model.get('geometry').coordinates); // lon, lat

                this.initIconStyle();
                this.initTextStyle();
                this.render();

                this.listenTo(this.model, 'change', this.redraw);
                this.listenTo(this.model, 'add:sequence remove:sequence',
                              function(command, collection, event) {
                                  if (command.hasParam('showWedge')) {
                                      this.redrawPolygons();
                                  } else if (command.get('type').indexOf('Pattern') > 0) {
                                      this.redrawPolygons();
                                  }
                              });
                this.model.on('station:remove', function() {
                    this.stationsVector.removeFeature(this.feature);
                }, this);

            },
            
            redrawPolygons: function() {
            	//TODO implement
            },
            
            render: function() {
                this.geometry = new ol.geom.Point(this.point);
                this.feature = new ol.Feature({geometry: this.geometry,
                                               id: this.model.attributes['id'],
                                               name: this.model.attributes['id'],
                                               model: this.model,
                                               iconStyle: this.iconStyle,
                                               selectedIconStyle: this.selectedIconStyle,
                                               textStyle: this.textStyle
//                                               'styles': this.getStyles(),
//                                               'selectedStyles': this.getSelectedStyles()
                                            });
                this.feature.set('styles', this.getStyles());
                this.feature.set('selectedStyles', this.getSelectedStyles());
                this.feature.setStyle([this.iconStyle, this.textStyle]);
                
//                this.listenTo(this.model, 'geometryChanged', this.geometryChanged, this);
                this.geometry.on('change', this.geometryChanged, this);

                this.model['feature'] = this.feature;
                this.stationsVector.addFeature(this.feature);
            },
            
            geometryChanged: function(event) {
            	 var coords = inverseTransform(this.geometry.getCoordinates());
            	 var oldCoords = this.model.getPoint();
//            	 if (oldCoords[0] != coords[0] && oldCoords[1] != coords[1]){
            		 this.model.setPoint({
                         lng: coords[0],
                         lat: coords[1]
                     });
//            	 }
                 
            },
            
            redraw: function() {
                if (_.isUndefined(this.geometry)){
                    return;
                }
                // redraw code. To be invoked when relevant model attributes change.
                app.Actions.disable();

                var coords = transform(this.model.get('geometry').coordinates);
                var existingCoords = this.geometry.getCoordinates();
                if ((coords[0] != existingCoords[0]) || 
                    (coords[1] != existingCoords[1])) {
                    this.geometry.setCoordinates(coords);
                }
                if (!_.isEqual(this.getLabel(), this.textStyle.getText().getText())){
                	
                	var selected = false;
                    if (this.feature.getStyle()[0] === this.getSelectedStyles()[0]){
                    	selected = true;
                    }
                    
                    // You can't change text of an existing style, you have to make a new one.
                    // https://github.com/openlayers/ol3/pull/2678
//                    textInStyle.set('text',name);
                    delete this.textStyle; // for garbage collection
                    this.initTextStyle();
                    
                    this.feature.set('selectedStyles', this.getSelectedStyles());
                    this.feature.set('styles', this.getStyles())
                    if (selected){
                    	this.feature.setStyle(this.getSelectedStyles());
                    } else {
                    	this.feature.setStyle(this.getStyles());
                    }
                }
                this.updateHeadingStyle();

                if (this.wedgeViews) {
                    _.each(this.wedgeViews, function(wedgeView) {
                        wedgeView.update();
                    });
                }
                if (this.commandViews) {
                    _.each(this.commandViews, function(commandView) {
                        commandView.update();
                    });
                }
                app.Actions.enable();
            },

            getHeading: function() {
                var heading = 0.0;
                try {
                    heading = this.model.get('headingDegrees');
                } catch(err) {
                    // nothing
                }
                if (_.isUndefined(heading) || _.isNull(heading)){
                    heading = 0.0;
                }  
                return heading;
            },
            
            initIconStyle: function() {
                if (this.model.get('isDirectional')) {
                    heading = this.getHeading();
                    app.styles['direction']['rotation'] = heading;
                    app.styles['selectedDirection']['rotation'] = heading;
                    this.iconStyle = new ol.style.Style({image: new ol.style.Icon(app.styles['direction'])});
                    this.selectedIconStyle = new ol.style.Style({image: new ol.style.Icon(app.styles['selectedDirection'])});
                    app.styles['direction']['rotation'] = 0.0;
                    app.styles['selectedDirection']['rotation'] = 0.0;
                } else {
                    this.iconStyle = app.styles['station'];
                    this.selectedIconStyle = app.styles['selectedStation'];
                }
            },
            
            updateHeadingStyle: function() {
                if (this.model.get('isDirectional')) {
                    var heading = this.getHeading();
                    this.iconStyle.set('rotation', heading);
                    this.selectedIconStyle.set('rotation', heading);
                } 
            },
            
            getLabel: function() {
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                return name;
            },
            
            initTextStyle: function() {
                var name = this.getLabel();
                var theText = new ol.style.Text(app.styles['stationText']);
                theText.setText(name);
                this.textStyle = new ol.style.Style({
                    text: theText
                });
            },
            
            getStyles: function() {
                return [this.iconStyle, this.textStyle];
            },
            
            getSelectedStyles: function() {
                return [this.selectedIconStyle, this.textStyle];
            },

            close: function() {
                this.stopListening();
            }

        });
    
});
