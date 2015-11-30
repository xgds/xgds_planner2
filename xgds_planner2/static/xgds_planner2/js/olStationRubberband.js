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

goog.provide('ol.interaction.StationRubberband');

goog.require('ol.DrawEvent');
goog.require('ol.DrawEventType');
goog.require('ol.interaction.Draw');
goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('ol.Collection');
goog.require('ol.Coordinate');
goog.require('ol.Feature');
goog.require('ol.FeatureOverlay');
goog.require('ol.MapBrowserEvent');
goog.require('ol.Object');
goog.require('ol.events.condition');
goog.require('ol.geom.GeometryType');
goog.require('ol.geom.LineString');
goog.require('ol.geom.Point');
goog.require('ol.interaction.Pointer');
goog.require('ol.source.Vector');
goog.require('ol.style.Style');
/**
 * @classdesc
 * Interaction that allows adding stations on the end with rubberbanding.
 *
 * @constructor
 * @extends {ol.interaction.Draw}
 * @fires ol.DrawEvent
 * @param {olx.interaction.DrawOptions} options Options.
 * @api stable
 */
ol.interaction.StationRubberband = function(options) {
    
    goog.base(this, {
        type: ol.interaction.DrawMode.LINE_STRING,
//        handleMoveEvent: ol.interaction.StationRubberband.handleMoveEvent_,
//        handleEvent: ol.interaction.StationRubberband.handleEvent_,
        handleDownEvent: ol.interaction.StationRubberband.handleDownEvent_,
        handleMapBrowserEvent: ol.interaction.StationRubberband.handleMapBrowserEvent_
      });
    
    
    /**
     * Start coordinates, undefined if not given
     * @type {[number, number]}
     * @private
     */
    this.startCoordinates_ = options.startCoordinates;
    
    /**
     * Start the drawing.
     * @param {ol.MapBrowserEvent} event Event.
     * @private
     */
    ol.interaction.StationRubberband.prototype.setStartCoordinates = function(newCoordinates){
        this.startCoordinates_ = newCoordinates;
    }
    
    
     /**
      * Start the drawing.
      * @param {ol.MapBrowserEvent} event Event.
      * @private
      */
     ol.interaction.Draw.prototype.startDrawing_ = function(event) {
       var start = event.coordinate;
       this.finishCoordinate_ = event.coordinate;
       var geometry;
       if (goog.isDef(this.startCoordinates_)){
           start = this.startCoordinates_;
           geometry = new ol.geom.LineString([start.slice(), this.finishCoordinate_.slice()], 'XY');
       } else {
           geometry = new ol.geom.LineString([start.slice(), start.slice()]);
       }
       goog.asserts.assert(goog.isDef(geometry));
       this.sketchFeature_ = new ol.Feature();
       if (goog.isDef(this.geometryName_)) {
         this.sketchFeature_.setGeometryName(this.geometryName_);
       }
       this.sketchFeature_.setGeometry(geometry);
       this.updateSketchFeatures_();
//       goog.base(this, 'updateSketchFeatures_');
       this.dispatchEvent(new ol.DrawEvent(ol.DrawEventType.DRAWSTART,
           this.sketchFeature_));
//       goog.base(this, 'dispatchEvent', [new ol.DrawEvent(ol.DrawEventType.DRAWSTART,
//               this.sketchFeature_]);
     };
     
     /**
      * Handle move events.
      * @param {ol.MapBrowserEvent} event A move event.
      * @return {boolean} Pass the event to other interactions.
      * @private
      */
//     ol.interaction.Draw.prototype.handlePointerMove_ = function(event) {
//       if (goog.isNull(this.finishCoordinate_)) {
//         this.startDrawing_(event);
//       } else if (!goog.isNull(this.finishCoordinate_)) {
//         this.modifyDrawing_(event);
//       } else {
//         this.createOrUpdateSketchPoint_(event);
//       }
//       return true;
//     };
     
//     ol.interaction.StationRubberband.handleMoveEvent_ = function(event){
//         if (goog.isNull(this.finishCoordinate_)) {
//             this.startDrawing_(event);
//         }
//     }

     /**
      * @param {ol.MapBrowserPointerEvent} event Event.
      * @return {boolean} Start drag sequence?
      * @this {ol.interaction.Draw}
      * @private
      */
     ol.interaction.StationRubberband.handleDownEvent_ = function(event) {
       if (this.condition_(event)) {
         this.downPx_ = event.pixel;
         if (goog.isNull(this.finishCoordinate_)) {
             this.startDrawing_(event);
         }
         return true;
       } else {
         return false;
       }
     };
     
     
     ol.interaction.StationRubberband.handleMapBrowserEvent_ = function(event) {
         if (goog.isNull(this.finishCoordinate_)) {
             this.startDrawing_(event);
         }
         return this.handleMapBrowseEvent(event);
       };
       
     
     /**
      * @param {ol.MapBrowserEvent} mapBrowserEvent Map browser event.
      * @return {boolean} `false` to stop event propagation.
      * @this {ol.interaction.Pointer}
      * @api
      */
     ol.interaction.StationRubberband.handleEvent = function(mapBrowserEvent) {
       if (!(mapBrowserEvent instanceof ol.MapBrowserPointerEvent)) {
         return true;
       }
       
       if (!goog.isDef(this.finishCoordinate_)) {
           
           if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERMOVE) {
               this.startDrawing_(event);
//               return ol.interaction.Draw.prototype.handlePointerMove_(mapBrowserEvent);
           }
       }
       
       return ol.interaction.Pointer.handleEvent(mapBrowserEvent);
//       return goog.base(this, 'ol.interaction.Pointer.handleEvent', [mapBrowserEvent]);

//       var stopEvent = false;
//       this.updateTrackedPointers_(mapBrowserEvent);
//       if (this.handlingDownUpSequence) {
//         if (mapBrowserEvent.type ==
//             ol.MapBrowserEvent.EventType.POINTERDRAG) {
//           this.handleDragEvent_(mapBrowserEvent);
//         } else if (mapBrowserEvent.type ==
//             ol.MapBrowserEvent.EventType.POINTERUP) {
//           this.handlingDownUpSequence =
//               this.handleUpEvent_(mapBrowserEvent);
//         }
//       }
//       if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERDOWN) {
//         var handled = this.handleDownEvent_(mapBrowserEvent);
//         this.handlingDownUpSequence = handled;
//         stopEvent = this.shouldStopEvent(handled);
//       } else if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERMOVE) {
//         this.handleMoveEvent_(mapBrowserEvent);
//       }
//       return !stopEvent;
     };
     
     /**
      * Modify the drawing.
      * @param {ol.MapBrowserEvent} event Event.
      * @private
      */
//     ol.interaction.Draw.prototype.modifyDrawing_ = function(event) {
//       var coordinate = event.coordinate;
//       var geometry = this.sketchFeature_.getGeometry();
//       var coordinates, last;
//         goog.asserts.assertInstanceof(geometry, ol.geom.LineString);
//         coordinates = geometry.getCoordinates();
//         if (this.atFinish_(event)){
//           // snap to finish
//           coordinate = this.finishCoordinate_.slice();
//         }
//         var sketchPointGeom = this.sketchPoint_.getGeometry();
//         goog.asserts.assertInstanceof(sketchPointGeom, ol.geom.Point);
//         sketchPointGeom.setCoordinates(coordinate);
//         last = coordinates[coordinates.length - 1];
//         last[0] = coordinate[0];
//         last[1] = coordinate[1];
//         goog.asserts.assertInstanceof(geometry, ol.geom.LineString);
//         geometry.setCoordinates(coordinates);
//         this.updateSketchFeatures_();
//     };

 }
goog.inherits(ol.interaction.StationRubberband, ol.interaction.Draw);