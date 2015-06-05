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