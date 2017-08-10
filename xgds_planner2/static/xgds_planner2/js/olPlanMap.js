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

// render json plan information on the openlayers map (as a layer from the tree)

var AbstractPlan = {
        initStyles: function() {
            if (_.isUndefined(this.styles)){
                this.styles = {};
                this.styles['lineStyle'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'orange',
                        width: 2
                      })
                    });
                this.styles['station'] = new ol.style.Style({
                    image: new ol.style.Icon({
                        src: '/static/xgds_planner2/images/placemark_circle_red.png',
                        scale: 0.6,
                        rotateWithView: false,
                        opacity: 0.8
                        })
                    });
             };
        },
        constructElements: function(plansJson){
            if (_.isEmpty(plansJson)){
                return null;
            }
            this.initStyles();
            var olFeatures = [];
            for (var i = 0; i < plansJson.length; i++) {
                var planFeatures = this.construct(plansJson[i]);
                olFeatures = olFeatures.concat(planFeatures);
            }
            var vectorLayer = new ol.layer.Vector({
                name: "Plans",
                source: new ol.source.Vector({
                    features: olFeatures
                })
            });  
            return vectorLayer;
        },
        construct: function(planJson){
            var allFeatures = [];
            var coords = [];
            var coord;
            for (var i = 0; i < planJson.stations.length; i++){
                coord = transform(planJson.stations[i].coords);
                coords.push(coord);
                allFeatures.push(this.constructStation(planJson.stations[i], coord));
            }
            var lineFeature = new ol.Feature({
                name: planJson.name,
                geometry: new ol.geom.LineString(coords)
            });
            lineFeature.setStyle(this.styles['lineStyle']);
            this.setupLinePopup(lineFeature, planJson);
            allFeatures.unshift(lineFeature);
            return allFeatures;
        },
        constructStation: function(stationJson, coord){
            var feature = new ol.Feature({
                name: stationJson.id,
                geometry: new ol.geom.Point(coord)
            });
            feature.setStyle(this.styles['station']);
            this.setupStationPopup(feature, stationJson);
            return feature;
        },
        setupStationPopup: function(feature, stationJson) {

        	var trString = "<tr><td>%s</td><td>%s</td></tr>";
            var formattedString = "<table>";
            for (var j = 0; j< 3; j++){
                formattedString = formattedString + trString;
                
            }
            formattedString = formattedString + "</table>"; 
            var data = ["Notes:", stationJson.notes,
                        "Lat:", stationJson.coords[1],
                        "Lon:", stationJson.coords[0]];
            feature['popup'] = vsprintf(formattedString, data);
        },
        setupLinePopup: function(feature, planJson) {
            var trString = "<tr><td>%s</td><td>%s</td></tr>";
            var formattedString = "<table>";
            for (var k = 0; k< 2; k++){
                formattedString = formattedString + trString;
            }
            formattedString = formattedString + "</table>";
            var data = ["Notes:", planJson.notes,
                        "Author:", planJson.author];
            feature['popup'] = vsprintf(formattedString, data);
        }
}