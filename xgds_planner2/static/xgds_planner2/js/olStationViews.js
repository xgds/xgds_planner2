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
    
    // This view class manages the map point for a single Station model
    app.views.StationPointView = Backbone.View
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
                    olStyles.styles['direction']['rotation'] = heading;
                    olStyles.styles['selectedDirection']['rotation'] = heading;
                    this.iconStyle = new ol.style.Style({image: new ol.style.Icon(olStyles.styles['direction'])});
                    this.selectedIconStyle = new ol.style.Style({image: new ol.style.Icon(olStyles.styles['selectedDirection'])});
                    olStyles.styles['direction']['rotation'] = 0.0;
                    olStyles.styles['selectedDirection']['rotation'] = 0.0;
                } else {
                    this.iconStyle = olStyles.styles['station'];
                    this.selectedIconStyle = olStyles.styles['selectedStation'];
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
                var theText = new ol.style.Text(olStyles.styles['stationText']);
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
