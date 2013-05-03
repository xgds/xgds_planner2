var geo = geo || {};
$(function(){

    var EARTH_RADIUS_METERS = 6371010;
    var DEG2RAD = Math.PI / 180.0;
    var RAD2DEG = 180.0 / Math.PI;
    

    /*
     Add an offset in meters to a coordinate pair specified as WGS84 Lat/Lon

    Extremely crude approximation.
    */
    geo.addMeters = function (latlng, xy){
        var latRad = latlng.lat * DEG2RAD;
        var latDiff = xy.y / EARTH_RADIUS_METERS;
        var lngDiff = xy.x / ( Math.cos(latRad) * EARTH_RADIUS_METERS );
        return {
            lat: latlng.lat + RAD2DEG * latDiff,
            lng: latlng.lng + RAD2DEG * lngDiff
        }
    };
    
    /*
    a and b are WGS84 lat/lon coordinates.  returns [x,y] displacement
    in meters that would get you from b to a.  x is easting and y is
    northing.

    Extremely crude approximation.
    */
    geo.calculateDiffMeters = function(a, b){
        var latDiff = (a.lat - b.lat) * DEG2RAD;
        var lonDiff = (a.lng - b.lng) * DEG2RAD;
        var lat = 0.5 * (a.lat + b.lat) * DEG2RAD;
        return {
            x: Math.cos(lat) * EARTH_RADIUS_METERS * lonDiff,
            y: EARTH_RADIUS_METERS * latDiff
        }
    };

    geo.norm = function(xy){
        return Math.sqrt( xy.x * xy.x + xy.y * xy.y );
    }
});
