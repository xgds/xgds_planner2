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

var genericVehicle = genericVehicle || {};

genericVehicle.Simulator = function() {
    this.elapsedTime = 0; // seconds
    this.distanceTraveled = 0; // meters
    this.coordinates = {
        lng: null,
        lat: null
    };
};

_.extend(genericVehicle.Simulator.prototype, {
    // Queries
    getElapsedTimeSeconds: function() {
        return this.elapsedTime;
    },
    getDistanceTraveledMeters: function() {
        return this.distanceTraveled;
    },

    // Control
    geoJsonToCoords: function(geoJson) {
        return {
            lng: geoJson.coordinates[0],
            lat: geoJson.coordinates[1]
        };
    },

    arrayToCoords: function(coordsArray) {
        return {
            lng: coordsArray[0],
            lat: coordsArray[1]
        };
    },
    
    startPlan: function(plan) {
        var firstStation = plan.get('sequence').at(0);
        this.coordinates = this.geoJsonToCoords(firstStation.get('geometry'));
    },
    endPlan: function(plan) {},

    startStation: function(station, context) {},
    endStation: function(station, context) {},

    startSegment: function(segment, context) {},
    endSegment: function(segment, context) {
    },

    executeCommand: function(command, context) {
        var duration = command.get('duration');
        this.elapsedTime = this.elapsedTime + duration;
    }
});
