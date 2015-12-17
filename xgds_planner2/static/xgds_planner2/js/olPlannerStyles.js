var olStyles = olStyles || {};

olStyles.buildPlannerStyles = function() {
	if (_.isUndefined(olStyles.styles)){
		olStyles.buildStyles();
    } else { // if defined, see if we already called this
    	try {
    		if (olStyles['segment']) {
    			return;
    		}
    	} catch (err){
    	}
    }
    olStyles.styles['segment'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'yellow',
            width: app.options.planLineWidthPixels
          })
        });
    olStyles.styles['selectedSegment'] = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'cyan',
            width: app.options.planLineWidthPixels + 2
          })
        });
    olStyles.styles['placemarkImage'] = new ol.style.Icon({
        src: app.options.placemarkCircleUrl,
        scale: .8,
        rotateWithView: false,
        opacity: 1.0
        });
    olStyles.styles['station'] = new ol.style.Style({
        image: olStyles.styles['placemarkImage']
        });
    olStyles.styles['selectedPlacemarkImage'] = new ol.style.Icon({
        src: app.options.placemarkCircleHighlightedUrl,
        scale: 1.2
        });
    olStyles.styles['selectedStation'] = new ol.style.Style({
        image: olStyles.styles['selectedPlacemarkImage']
        });
    olStyles.styles['direction'] = {
            src: app.options.placemarkDirectionalUrl,
            scale: 0.85,
            rotation: 0.0,
            rotateWithView: true
            };
    olStyles.styles['selectedDirection'] = {
            src: app.options.placemarkSelectedDirectionalUrl,
            scale: 1.2,
            rotation: 0.0,
            rotateWithView: true
            };
    
    olStyles.styles['stationText'] = {
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
    olStyles.styles['segmentText'] = {
            font: '14px Calibri,sans-serif',
            stroke: new ol.style.Stroke({
                color: 'red',
                width: 1
            })
        };
}