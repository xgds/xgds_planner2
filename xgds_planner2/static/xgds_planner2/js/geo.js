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

var geo = geo || {};
$(function() {

    var DEG2RAD = Math.PI / 180.0;
    var RAD2DEG = 180.0 / Math.PI;


    /*
     Add an offset in meters to a coordinate pair specified as WGS84 Lat/Lon

    Extremely crude approximation.
    */
    geo.addMeters = function(latlng, xy) {
        var latRad = latlng.lat * DEG2RAD;
        var latDiff = xy.y / app.options.BODY_RADIUS_METERS;
        var lngDiff = xy.x / (Math.cos(latRad) * app.options.BODY_RADIUS_METERS);
        return {
            lat: latlng.lat + RAD2DEG * latDiff,
            lng: latlng.lng + RAD2DEG * lngDiff
        };
    };

    /*
    a and b are WGS84 lat/lon coordinates.  returns [x,y] displacement
    in meters that would get you from b to a.  x is easting and y is
    northing.

    Extremely crude approximation.
    */
    geo.calculateDiffMeters = function(a, b) {
        var latDiff = (a.lat - b.lat) * DEG2RAD;
        var lonDiff = (a.lng - b.lng) * DEG2RAD;
        var lat = 0.5 * (a.lat + b.lat) * DEG2RAD;
        return {
            x: Math.cos(lat) * app.options.BODY_RADIUS_METERS * lonDiff,
            y: app.options.BODY_RADIUS_METERS * latDiff
        };
    };

    geo.calculateLengthMeters = function(a, b) {
        var partial = geo.calculateDiffMeters(a, b);
        var result = Math.pow(partial.x, 2) + Math.pow(partial.y, 2);
        if (a.depth && b.depth) {
                result += Math.pow((a.depth - b.depth), 2);
        }
        length = Math.sqrt(result);
        return {
                x: partial.x,
                y: partial.y,
                length: length
        };
    };

    geo.calculateBearing = function(a, b) {
        var dLon = (b.lng - a.lng) * DEG2RAD;
        var y = Math.sin(dLon) * Math.cos(b.lat);
        var x = (Math.cos(a.lat) * Math.sin(b.lat) -
                 Math.sin(a.lat) * Math.cos(b.lat) * Math.cos(dLon));
        var result = Math.atan2(y, x);
        return result * RAD2DEG;
    };

    geo.getBearingDegrees = function(x, y) {
            var result = 90.0 - RAD2DEG * Math.atan2(y, x);
            if (result < 0) {
                result += 360;
            }
            return result;
    };

    geo.norm = function(xy) {
        return Math.sqrt(xy.x * xy.x + xy.y * xy.y);
    };
});
