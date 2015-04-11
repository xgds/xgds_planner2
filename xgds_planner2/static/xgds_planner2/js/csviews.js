// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

var DEG2RAD = Math.PI / 180.0;

var DEBUG_SEGMENTS = false;
var STATION_LABEL_OFFSET = new Cesium.Cartesian2(0, -10);
var STATION_SCALE_BY_DISTANCE = new Cesium.NearFarScalar({
    near: 0.25,
    nearValue: 0.25
});

$(function() {
    app.views = app.views || {};

    app.views.CSView = Backbone.View.extend({
            el: 'div',

            initialize: function(options) {
                this.options = options || {};
                _.bindAll(this);
                this.$el.resizable();
                // pre-set certain variables to speed up this code
                app.State.pageContainer = this.$el.parent();
                app.State.tabsContainer = $('#tabs');
                app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
                var horizOrigin = this.$el.width();
                this.$el.bind('resize', function() {
                    if (app.State.mapResized == false && app.map.$el.width() != horizOrigin) {
                        app.State.mapResized = true;
                    } else {
                        // only change element widths if the horizontal width has changed at least once
                        return;
                    }
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                });
                // also bind to window to adjust on window size change
                $(window).bind('resize', function() {
                    // window size changed, so variables need to be reset
                    if (_.isUndefined(app.tabs.currentView)) {return;}
                    if (!app.State.mapResized) {return;} // until the element is resized once, resizing happens automatically
                    app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                    app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                });
                
                this.map = new Cesium.Viewer('map');
                app.map = this.map;
                // todo get long lat and height from plan
                this.map.camera.setView({
                    position : Cesium.Cartesian3.fromDegrees(-121.737714, 50.866680, 50),
                    heading : 0.0,
                    pitch : -Cesium.Math.PI_OVER_TWO,
                    roll : 0.0
                }); 
                this.buildMaterials();
                app.vent.on('layers:loaded', this.render);
                app.vent.on('layers:loaded', this.initializeMapData);
                app.vent.on('tree:loaded', this.updateMapLayers);
                app.vent.on('kmlNode:create', function(node) {
                    this.createKmlLayerView(node);
                }, this);

                app.vent.trigger('layers:loaded');
                this.updateBbox();

            },
            
            // load map tree ahead of time to load layers into map
            initializeMapData: function() {
                $.ajax({
                    url: app.options.layerFeedUrl,
                    dataType: 'json',
                    success: $.proxy(function(data) {
                        app.treeData = data;
                        app.kmlMap = {}; // temporary hashmap
                        this.initializeMapLayers(app.treeData[0]);
                    }, this)
                  });
            },
            
            // read through the json data and turn on layers that should be on
            initializeMapLayers: function(node, index, collection) {
                if (node.selected){
                   // create the kml layer view and
                   // store the layer in a map so we can get it later
                   app.kmlMap[node.data.kmlFile] = this.createKmlLayerView(node);
                }
                if (!_.isUndefined(node.children)){
                    for (var i = 0; i < node.children.length; i++){
                        this.initializeMapLayers(node.children[i]);
                    }
                }
            }, 
            
            createKmlLayerView: function(node) {
                //  create the kml layer view
                var kmlLayerView = new KmlLayerView({
                    node: node,
                    kmlFile: node.data.kmlFile
                });
                node.kmlLayerView = kmlLayerView;
                return kmlLayerView;
            },
            
            updateMapLayers: function() {
                if (!_.isUndefined(app.tree)){
                    var selectedNodes = app.tree.getSelectedNodes();
                    selectedNodes.forEach(function(node){
                        if (_.isUndefined(node.kmlLayerView) && node.selected){
                            var kmlLayerView = app.kmlMap[node.data.kmlFile];
                            if (!_.isUndefined(kmlLayerView)){
                                kmlLayerView.node = node;
                                node.kmlLayerView = kmlLayerView;
                            } else {
                                this.createKmlLayerView(node);
                            }
                        }
                    }, this);
                }
            },
            
            updateBbox: function() {
                this.map.zoomTo(this.map.entities);
                this.map.zoomTo(this.segments);
             // move to bounding box defined in plan
//                var site = app.currentPlan.get('site');
//                if (site != undefined)
//                    var bbox = site.bbox;
//                if (bbox != undefined) {
//                    var extent = [bbox[1], bbox[0], bbox[3], bbox[2]];
//                    extent = ol.extent.applyTransform(extent, ol.proj.getTransform("EPSG:4326", "EPSG:3857"));
//                    this.map.getView().fitExtent(extent, this.map.getSize());
//                }
            },
            
            buildMaterials: function() {
                app.materials = new Object();
                
                app.materials['segment'] = new Cesium.Material({
                    fabric : {
                        type : 'Color',
                        uniforms : {
                          color : Cesium.Color.YELLOW
                        }
                      }
                    });
                app.materials['selectedSegment'] = new Cesium.Material({
                    fabric : {
                        type : 'Color',
                        uniforms : {
                          color : Cesium.Color.CYAN
                        }
                      }
                    });
                app.materials['station'] = new Cesium.Material({
                    fabric : {
                        type : 'Image',
                        uniforms : {
                          image : app.options.placemarkCircleUrl
                        }
                      }
                });
                app.materials['selectedStation'] = new Cesium.Material({
                    fabric : {
                        type : 'Image',
                        uniforms : {
                          image : app.options.placemarkCircleHighlightedUrl
                        }
                      }
                });
                app.materials['direction'] = new Cesium.Material({
                    fabric : {
                        type : 'Image',
                        uniforms : {
                          image : app.options.placemarkDirectionalUrl
                        }
                      }
                });
                app.materials['selectedDirection'] = new Cesium.Material({
                    fabric : {
                        type : 'Image',
                        uniforms : {
                          image : app.options.placemarkSelectedDirectionalUrl
                        }
                      }
                });

            },

            render: function() {
                //           console.log('re-rendering map');
                //this.updateMapLayers();
                this.drawPlan();
                this.updateBbox();
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
                
                this.segments = new Cesium.EntityCollection();
                this.stations = new Cesium.EntityCollection();
                this.map.entities.add(this.segments);
                this.map.entities.add(this.stations);

                app.vent.on('mapmode', this.setMode, this);
                app.vent.trigger('mapmode', 'navigate');
                
                this.collection.resequence(); // Sometimes it doesn't resequence itself on load
                this.listenTo(app.currentPlan, 'sync', this.render, this);

                app.State.planLoaded = true;
            },

            render: function() {
                this.drawStations();
                this.drawSegments();
                
                if (this.currentMode) {
                    this.resetMode();
                }
                
                // scale map to focus on plan
//                if (!_.isEmpty(this.segmentsVector.getFeatures())){
//                    this.map.getView().fitExtent(this.segmentsVector.getExtent(), this.map.getSize());
//                }

            },

            drawStation: function(station) {
                var stationPointView = new StationPointView({
                    model: station,
                    stations: this.stations
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
                    segments: this.segments,
                    planLayerView: this
                });
                return segmentLineView;
            },

            drawSegments: function() {
                this.collection.each(function(item, index, list) {
                    if (item.get('type') == 'Segment') {
                        var fromStation = list[index - 1];
                        var toStation = list[index + 1];
                        this.drawSegment(item, fromStation, toStation);
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
                    app.State.disableAddStation = false; // reset state possibly set in other mode
                    if (_.isUndefined(this.stationAdder)){
//                        this.stationAdder = new ol.interaction.StationRubberband({
                        this.stationAdder = new ol.interaction.Draw({
                            features: this.featureOverlay.getFeatures(),
                            type: ol.interaction.DrawMode.POINT
//                            startCoordinates: this.getLastStationCoords()
                        }, this);
//                        this.stationAdder.on('drawstart', function(event) {
//                                console.log(event);
//                                endStation = this.collection.at(this.collection.length - 1);
//                                firstCoords = transform(endStation.get('geometry').coordinates);
//                                var newGeometry = event.feature.getGeometry();
//                                firstCoords.push(newGeometry.getCoordinates());
//                                newGeometry.setCoordinates(firstCoords);
//                            }, this);
                        this.stationAdder.on('drawend', function(event) {
                            var geometry = event.feature.getGeometry();
                            var coords = inverse(geometry.getCoordinates());
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
                    this.map.addInteraction(this.stationAdder);
                },
                exit: function() {
                    this.map.removeInteraction(this.stationAdder);
                }
            }, // end addStationMode
            
            navigateMode: {
                enter: function() {
                    /*
                    if (_.isUndefined(this.selectNavigate)){
                        this.selectNavigate = new ol.interaction.Select({
                            layers: [this.segmentsLayer, this.stationsLayer],
                            style: (function() {
                                  return function(feature, resolution) {
                                      var model = feature.get('model');
                                      console.log('style method ');
                                      console.log(model.get('type'));
                                      switch (model.get('type')) {
                                      case 'Station':
                                          var iconStyle = feature.get('selectedIconStyle');
                                          var textStyle = feature.get('textStyle');
                                          return [iconStyle, textStyle];
                                      case 'Segment':
                                          return [app.materials['selectedSegment']];
                                      }
                                  };
                                })()
                            });
                        
                        this.selectNavigate.getFeatures().on('add', function(e) {
                            var feature = e.element;
                            var model = feature.get('model');
                            switch (model.get('type')) {
                                case 'Station':
                                    app.State.stationSelected = feature.get('model');
                                    app.State.segmentSelected = undefined;
                                    break;
                                case 'Segment':
                                    app.State.segmentSelected = feature.get('model');
                                    app.State.stationSelected = undefined;
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
                        this.listenTo(app.vent, 'showItem:station', function() {
                            var selectedItem = app.State.stationSelected;
                            this.mapSelect(selectedItem);
                        });
                        
                        this.listenTo(app.vent, 'showItem:segment', function() {
                            var selectedItem = app.State.stationSelected;
                            this.mapSelect(selectedItem);
                        });
                        
                    };
                    this.map.addInteraction(this.selectNavigate);
                    */
                    
                },
                exit: function() {
//                    this.map.removeInteraction(this.selectNavigate);
                }
            },
            
            mapSelect: function(selectedItem){
                if (!_.isUndefined(selectedItem)){
                    var snav = this.selectNavigate;
                    var features = this.selectNavigate.getFeatures();
                    var foundFeature = selectedItem['feature'];
                    if (features.getLength() > 0){
                        if (features.item(0) == foundFeature) {
                            return;
                        }
                        features.forEach(function(item, index, array){
                            var model = item.get('model');
                            switch (model.get('type')) {
                            case 'Station':
                                var iconStyle = item.get('iconStyle');
                                var textStyle = item.getStyle()[1];
                                item.setStyle([iconStyle, textStyle]);
                                break;
                            case 'Segment':
                                item.setStyle([app.materials['segment']]);
                                break;
                            }
                        });
                        features.clear();
                    }
                    
                    features.push(foundFeature);
                    switch (foundFeature.get('model').get('type')) {
                    case 'Station':
                        var iconStyle = foundFeature.get('selectedIconStyle');
                        var textStyle = foundFeature.get('textStyle');
                        foundFeature.setStyle([iconStyle, textStyle]);
                        break;
                    case 'Segment':
                        foundFeature.setStyle([app.materials['selectedSegment']]);
                        break;
                    }
                }  
            },
            
            repositionMode: {
                enter: function() {
                    if (_.isUndefined(this.repositioner)){
                        this.repositioner = new ol.interaction.Modify({
                            features: this.featureOverlay.getFeatures(),
                            deleteCondition: function(event) {
                                return ol.events.condition.shiftKeyOnly(event) &&
                                    ol.events.condition.singleClick(event);
                              }
                        });
                        this.stationDeleter = new ol.interaction.Select({
                            layers: [this.stationsLayer],
                            // for debugging
                            style: new ol.style.Style({
                                image: new ol.style.Circle({
                                  radius: 12,
                                  fill: new ol.style.Fill({
                                    color: 'rgba(255, 0, 0, 0.5)'
                                  })
                                })
                              }),
                            addCondition: function(event) {
                                return ol.events.condition.shiftKeyOnly(event)
                                && ol.events.condition.singleClick(event);
                              }
                            });
                        
                        this.stationDeleter.getFeatures().on('add', function(e) {
                            var feature = e.element;
                            var model = feature.get('model');
                            if (!_.isUndefined(model)){
                                // delete the station
                                var killedSegment = this.collection.removeStation(model);
                            }
                            
                        }, this);
                        this.listenTo(app.vent, 'station:remove', function(killedStation) {
                            if (!_.isUndefined(killedStation)){
                                var feature = killedStation.feature;
                                if (!_.isUndefined(feature)){
                                    this.stationDeleter.getFeatures().clear();
                                }
                            }
                        }, this);
                    }
                    this.map.addInteraction(this.repositioner);
                    this.map.addInteraction(this.stationDeleter);
                }, // end enter
                exit: function() {
                    this.map.removeInteraction(this.repositioner);
                    this.map.removeInteraction(this.stationDeleter);
                }
            } // end repositionMode

        });
    
    var SegmentLineView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            var options = this.options;
            if (!options.segments && options.toStation && options.fromStation) {
                throw 'Missing a required option!';
            }
            this.segments = this.options.segments;
            this.planLayerView = this.options.planLayerView;
            this.fromStation = this.options.fromStation;
            this.toStation = this.options.toStation;
            this.otherStation = {};
            this.otherStation[this.toStation.cid] = this.fromStation;
            this.otherStation[this.fromStation.cid] = this.toStation;
            _.each([this.fromStation, this.toStation],
                    function(stationModel) {
                        this.addChangeListener(stationModel);
                    }, this);
//            this.model.on('change:geometry', function() {
//                this.updateGeometry(this.fromStation, this.toStation);
//            }, this);
            this.model.on('alter:stations', function() {
                this.updateStations();
                this.updateGeometry(this.fromStation, this.toStation);
            }, this);
            this.model.on('segment:remove', function() {
                var feature = this.feature;
                if (!_.isUndefined(feature)){
                    this.removeChangeListener(this.fromStation);
                    this.removeChangeListener(this.toStation);
                    this.segmentsVector.removeFeature(feature);
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
//                    if (!_.isEqual(this.getLabel(), this.textStyle.getText().getText())){
//                        delete this.textStyle; // for garbage collection
//                        this.feature.setStyle(this.getStyles());
//                    }
                }
            }
        },
        
        removeChangeListener: function(station){
          station.off('change:geometry');  
        },
        addChangeListener: function(station) {
            station.on('change:geometry',
                    function() {
                        this.updateGeometry(station);
                    }, 
                    this);
        },

        getStyles: function() {
            if (DEBUG_SEGMENTS){
                this.initTextStyle();
                return [app.materials['segment'], this.textStyle]
            } else {
                return [app.materials['segment']];
            }
        },
        getCoords: function() {
          var allcoords = this.fromStation.get('geometry').coordinates;
          allcoords = allcoords.concat(this.toStation.get('geometry').coordinates)
          var result = Cesium.Cartesian3.fromDegreesArray(allcoords);
          return result;
        },
        render: function() {
            this.feature = app.map.entities.add({

                name: this.fromStation.attributes['id'],
                polyline: {
                    positions: this.getCoords(),
                    width: app.options.planLineWidthPixels,
                    material: Cesium.Color.YELLOW,
                    followSurface: true
                },
                model: this.model
            });
            if (DEBUG_SEGMENTS){
                this.feature.setLabel(new Cesium.LabelGraphics({
                    text: this.getLabel(),
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    scale: 0.5,
                    pixelOffset: STATION_LABEL_OFFSET
                }));
            }
            this.segments.add(this.feature);

            // for some reason you have to set the style this way
           /* this.geometry.on('change', function(event) {
                var geometry = event.target;
                var newCoordinates = geometry.getCoordinates();
                if (newCoordinates.length > 2) {
                    // add the new station!
                    var oldSegment = this.model; //event.target.get('model');
                    var oldFirstStation = this.fromStation;
                    var newStation = app.models.stationFactory({
                        coordinates: inverse(newCoordinates[1])
                    });
                    var segmentBefore = this.planLayerView.collection.insertStation(oldSegment, newStation);
                    var stationPointView = this.planLayerView.drawStation(newStation);
                    this.planLayerView.stationViews.push(stationPointView);
                    
                    if (!_.isUndefined(segmentBefore)){
                        this.planLayerView.drawSegment(segmentBefore, oldFirstStation, newStation);
                    }
                    
                    //total hack, remove and readd this segment to the feature
                    // this will prevent continuing to edit the second point of the segment (ie the one we just added)
                    try {
                        this.featureOverlay.removeFeature(this.feature);
                    } catch (err){
                        // ulp
                    }
                    this.featureOverlay.addFeature(this.feature);
                    
                }
                
            }, this); */
            this.model['feature'] = this.feature;
//            this.segmentsVector.addFeature(this.feature);
//            this.featureOverlay.addFeature(this.feature);
        },
        /*
         ** Update the endpoints of the segment when either adjacent station changes.
         ** points can be either station PathElements, or an array of coordinates (lon, lat)
         ** You can also supply just one station PathElement
         */
         updateGeometry: function(point1, point2) {
             if (!_.isUndefined(this.fromStation) && !_.isUndefined(this.toStation)){
                 this.coords = _.map([this.fromStation, this.toStation],
                         function(station) {
                             return transform(station.get('geometry').coordinates);
                         });
                 this.geometry.setCoordinates(this.coords);
             }

//             if (_.isUndefined(point2) && !_.isUndefined(point1) && point1.cid) {
//                 // only one model was supplied for update.  Go get the other one.
//                 point2 = this.otherStation[point1.cid];
//             }
//
//             if (point1 && point2) {
//                 var coords = [];
//                 _.each([point1, point2], function(point) {
//                     if (_.isArray(point)) {
//                         coords.push(transform(point));
//                     } else if (_.isObject(point) && _.has(point, 'lat') && _.has(point, 'lng')) {
//                         coords.push(transform([point.lng, point.lat]));
//                     } else if (_.isObject(point) && _.isFunction(point.get)) {
//                         coords.push(transform(point.get('geometry').coordinates));
//                     }
//                 });
//                 
//                 this.geometry.setCoordinates(coords);
//             }

         },
         
         // for debugging put a label on the segment
         getLabel: function() {
             var sequence = app.currentPlan.get('sequence');
             var segIndex = sequence.indexOf(this.model);
             var name = '' + segIndex + '(' + sequence.indexOf(this.fromStation) + ',' + sequence.indexOf(this.toStation) + ')';
             return name;
         }
         
    });
    
    var KmlLayerView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            this.kmlFile = this.options.kmlFile;
            this.node = this.options.node; // may be undefined
            
            if (!options.kmlFile) {
                throw 'Missing a required option!';
            }
            this.constructDataSource();
            this.render();
        },
        constructDataSource: function() {
            if (_.isUndefined(this.dataSource)){
                this.dataSource = new Cesium.KmlDataSource.load(this.kmlFile);
            }
        },
        render: function() {
            if (_.isUndefined(this.node)){
                app.map.map.dataSources.add(this.dataSource);
            } else if (this.node.selected){
                app.map.map.dataSources.add(this.dataSource);
            } else {
                app.map.map.dataSources.remove(this.dataSource);
            }
        }
    });
    
 // This view class manages the map point for a single Station model
    var StationPointView = Backbone.View
        .extend({
            initialize: function(options) {
                this.options = options || {};
                this.stations = this.options.stations;
                
                if (!options.stations && !options.model) {
                    throw 'Missing a required option!';
                }

                var pmOptions = {};
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                pmOptions.name = name || this.model.toString();
//                this.point = transform(this.model.get('geometry').coordinates); // lon, lat

//                this.initIconStyle();
//                this.initTextStyle();
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
                    this.stations.remove(this.feature);
                }, this);

            },
            getCoords: function() {
                var coords = this.model.get('geometry').coordinates;
                var result = Cesium.Cartesian3.fromDegrees(coords[0], coords[1]);
                return result;
              },
            
            getMaterial: function() {
                
            },
            render: function() {
                this.feature = app.map.entities.add({
                    name: this.model.attributes['id'],
                    position: this.getCoords(),
                    ellipse: {
                        semiMinorAxis: app.options.planLineWidthPixels/2,
                        semiMajorAxis: app.options.planLineWidthPixels/2,
                        height: 0.1,
                        material: this.initIconStyle()
                    },
                    label: new Cesium.LabelGraphics({
                        text: this.getLabel(),
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        scale: 0.5,
                        pixelOffset: STATION_LABEL_OFFSET
//                        pixelOffsetScaleByDistance: STATION_SCALE_BY_DISTANCE
                    }),
                    model: this.model
                });
                this.stations.add(this.feature);
//                this.feature = new ol.Feature({'geometry': this.geometry,
//                                               'id': this.model.attributes['id'],
//                                               'model': this.model,
//                                               'iconStyle': this.iconStyle,
//                                               'selectedIconStyle': this.selectedIconStyle,
//                                               'textStyle': this.textStyle
//                                            });
//                this.feature.setStyle([this.iconStyle, this.textStyle]);
//                this.feature.on('remove', function(event) {
//                    console.log(this);
//                }, this);
//                this.feature.on('change', function(event) {
//                    var geometry = event.target.get('geometry');
//                    var model = event.target.get('model');
//                    var coords = inverse(geometry.flatCoordinates);
//                    model.setPoint({
//                        lng: coords[0],
//                        lat: coords[1]
//                    });
//                });

                this.model['feature'] = this.feature;
            },
            
            redraw: function() {
                if (_.isUndefined(this.feature)){
                    return;
                }
                // redraw code. To be invoked when relevant model attributes change.
                app.Actions.disable();

                //TODO implement
                var coords = transform(this.model.get('geometry').coordinates);
                var existingCoords = this.geometry.getCoordinates();
                if ((coords[0] != existingCoords[0]) || 
                    (coords[1] != existingCoords[1])) {
                    this.geometry.setCoordinates(coords);
                }
                if (!_.isEqual(this.getLabel(), this.textStyle.getText().getText())){
                    // You can't change text of an existing style, you have to make a new one.
                    // https://github.com/openlayers/ol3/pull/2678
//                    textInStyle.set('text',name);
                    delete this.textStyle; // for garbage collection
                    this.initTextStyle();
                    this.feature.setStyle([this.iconStyle, this.textStyle]);
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
                app.Actions.action();
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
                return Cesium.Math.toRadians(heading);
            },
            
            initIconStyle: function() {
                if (this.model.get('isDirectional')) {
                    updateHeading();
                    this.iconStyle = app.materials['direction'];
                    this.selectedIconStyle = app.materials['selectedDirection'];
                } else {
                    this.iconStyle = app.materials['station'];
                    this.selectedIconStyle = app.materials['selectedStation'];
                }
                return this.iconStyle;
            },
            
            updateHeading: function() {
                if (this.model.get('isDirectional')) {
                    this.feature.setOrientation({
                        heading : this.getHeading()
                    });
                    if (this.iconStyle != app.materials['direction']){
                        this.iconStyle = app.materials['direction'];
                        this.selectedIconStyle = app.materials['selectedDirection'];
                        this.feature.ellipse.setMaterial(this.iconStyle);
                    }
                }  else {
                    if (this.iconStyle == app.materials['direction']){
                        this.iconStyle = app.materials['station'];
                        this.selectedIconStyle = app.materials['selectedStation'];
                        this.feature.ellipse.setMaterial(this.iconStyle);
                    }
                }
            },
            
            getLabel: function() {
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                return name;
            },
            
            close: function() {
                this.stopListening();
            }

        });
    
});
