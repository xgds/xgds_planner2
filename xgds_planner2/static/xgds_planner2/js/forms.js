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

(function(Form) {
    // No, backbone forms, 0 is not a safe default for number fields
    Form.editors.Number = Form.editors.Number.extend({
        defaultValue: null
    });

    Form.editors.HMS = Form.editors.Text.extend({
        defaultValue: 0,
        getValue: function() {
            var value = this.$el.val();
            return value === '' ? null : app.util.HMSToMinutes(value);
        },

        setValue: function(value) {
            value = (function() {
                if (_.isNumber(value)) return  value;
                if (_.isString(value) && value != '') return  parseFloat(value, 10);
                return 0;
            })();

            if (_.isNaN(value)) {
                value = 0;
            }

            Form.editors.Text.prototype.setValue.call(this, app.util.minutesToHMS(value));
        }
    });

    // We need a number select, because python isn't loosely typed
    Form.editors.NumberSelect = Backbone.Form.editors.Select.extend({
        getValue: function() {
            var value = this.$el.val();

            return value === '' ? null : parseFloat(value, 10);
        },

        setValue: function(value) {
            value = (function() {
                if (_.isNumber(value)) return value;

                if (_.isString(value) && value != '') return parseFloat(value, 10);

                return null;
            })();

            if (_.isNaN(value)) {
                value = null;
            }

            Form.editors.Select.prototype.setValue.call(this, value);
        }
    });

    Form.editors.Coordinates = Form.editors.Text.extend({
        initialize: function(options) {
            Form.editors.Text.prototype.initialize.apply(this, arguments);
            this.siteFrameMode = this.model.has('_siteFrame') ?
                this.model.get('_siteFrame') : false;
            this.alternateCrs = _.has(app.planJson.site, 'alternateCrs') ?
                app.planJson.site.alternateCrs : null;
            this.schema.title = this.getGeometryLabel();
            this.schema.help = this.getGeometryHelp();
            this.coordinates = undefined;
            this.listenTo(this.model, 'change:_siteFrame', this.toggleSiteFrame);
        },

        /**
         * Returns the current editor value
         * @return {String}
         */
        getValue: function() {
            var str = this.$el.val();
            var coords = str.split(/[,\s]\s*/);
            // in the background, always deal with lat, lon
            if (this.siteFrameMode) {
                var coords = !_.isNull(this.alternateCrs) ?
                    app.util.toLngLat(coords, this.alternateCrs) : coords;
            }
            var lng = parseFloat(coords[0]);
            var lat = parseFloat(coords[1]);
            // alway returns lng/lat
            return {
                type: 'Point',
                coordinates: [lng, lat]
            };
        },

        /**
         * Sets the value of the form element
         * @param {String} value
         */
        setValue: function(value) {
            // backend always deals with lng/lat
            // always takes lng/lat
            var decimalPlaces = 7;
            if (this.siteFrameMode) {
                var coords = !_.isNull(this.alternateCrs) ?
                    app.util.toSiteFrame(value.coordinates, this.alternateCrs) :
                    value.coordinates;
                    decimalPlaces = 2;
            } else {
                var coords = value.coordinates;
            }

            var str = '' + coords[0].toFixed(decimalPlaces) + ', ' + coords[1].toFixed(decimalPlaces);
            this.$el.val(str);
        },

        getGeometryLabel: function() {
            // returns either Lon, Lat, Geometry, or whatever the schema has defined
            // as the label for the alternateCrs geometry
            if (_.isNull(this.alternateCrs)) {
                return 'Lon, Lat';
            }
            var newTitle = '';
            if (this.siteFrameMode) {
                newTitle = _.has(this.alternateCrs.properties, 'coordinateLabel') ?
                    this.alternateCrs.properties.coordinateLabel : 'Geometry';
            } else {
                newTitle = 'Lon, Lat';
            }
            return newTitle;
        },
        getGeometryHelp: function() {
            // returns either Lon, Lat, Geometry, or whatever the schema has defined
            // as the label for the alternateCrs geometry
            if (_.isNull(this.alternateCrs)) {
                return 'Lon, Lat';
            }
            var newHelp = '';
            if (this.siteFrameMode) {
                newHelp = _.has(this.alternateCrs.properties, 'coordinateNotes') ?
                    this.alternateCrs.properties.coordinateNotes : this.getGeometryLabel();
            } else {
                newHelp = 'Lon, Lat';
            }
            return newHelp;
        },

        toggleSiteFrame: function(siteFrameMode) {
            if (_.isNull(this.alternateCrs)) {
                throw 'No alternate CRS defined';
            }
            var oldValue = this.getValue();
            var newsetting = false;
            if (this.model.has('_siteFrame')) {
                newsetting = this.model.get('_siteFrame');
            }
            this.siteFrameMode = _.isBoolean(siteFrameMode) ?
                siteFrameMode : newsetting; //!this.siteFrameMode;
            var newTitle = this.getGeometryLabel();
            var field = this.form.fields[this.key];
            field.schema.title = newTitle;
            field.$el.find('label').html(newTitle);
            var newHelp = this.getGeometryHelp();
            field.schema.help = newHelp;
            field.$el.find('.bbf-help').last().html(newHelp);
            this.setValue(oldValue);
        }
    });

    Form.editors.MinMaxNumber = Form.editors.Number
        .extend({
            initialize: function(options) {
                Form.editors.Number.prototype.initialize
                    .call(this, options);
                this.minimum = _.isNumber(this.schema.minimum) ?
                    this.schema.minimum : undefined;
                this.maximum = _.isNumber(this.schema.maximum) ?
                    this.schema.maximum : undefined;
                this.strictMinimum = _.isBoolean(this.schema.strictMinimum) ?
                    this.schema.strictMinimum : false;
                this.strictMaximum = _.isBoolean(this.schema.strictMaximum) ?
                    this.schema.strictMaximum : false;
                if (_.isUndefined(this.maximum) &&
                    _.isUndefined(this.minimum)) {
                    console.warn('MinMaxField initialized without supplying a minimum or a maximum');
                }
            },

            validate: function() {
                var error = Form.editors.Number.prototype.validate
                    .call(this);
                if (!_.isNull(error)) {
                    return error;
                }
                if (_.isNumber(this.minimum)) {
                    if (this.strictMinimum &&
                        this.minimum >= this.getValue()) {
                        error = {
                            type: 'minimum',
                            message: 'Value must be greater than ' +
                                this.minimum
                        };
                    } else if (this.minimum > this.getValue()) {
                        error = {
                            type: 'minimum',
                            message: 'Value must be greater than or equal to ' +
                                this.minimum
                        };
                    }
                }
                if (_.isNumber(this.maximum)) {
                    if (this.strictMaximum &&
                        this.maximum <= this.getValue()) {
                        error = {
                            type: 'maximum',
                            message: 'Value must be less than ' +
                                this.maximum
                        };
                    } else if (this.maximum < this.getValue()) {
                        error = {
                            type: 'maximum',
                            message: 'Value must be less than or equal to ' +
                                this.minimum
                        };
                    }
                }
                return error;
            }
        });

    Form.UnitField = Form.Field
        .extend({

            initialize: function(options) {
                Form.Field.prototype.initialize.call(this, options);
                this.subUnits = {};
                if (_.has(this.schema, 'unit')) {
                    this.unit = this.schema.unit;
                    if (!_.has(app.units, this.schema.unit)) {
                        console
                            .warn('UnitField initialized with a unit not found in the plan schema: ' +
                                  this.schema.unit);
                    } else {
                        _.each(
                            _.filter(
                                _.keys(
                                    app.unitSpecs[app.units[this.unit]].units), function(unit) {
                                        return unit != this.unit;
                                    },
                                this), function(subUnit) {
                                    this.subUnits[subUnit] = (app.unitSpecs[app.units[this.unit]].units[this.unit] /
                                                              app.unitSpecs[app.units[this.unit]].units[subUnit]);
                                }, this);
                    }
                } else {
                    this.unit = undefined;
                }
                this.template = Handlebars.compile($('#template-unit-field').html());
                this.listenTo(this.editor, 'change', this.updateUnits);
            },

            updateUnits: function() {
                if (_.isUndefined(this.unit)) {
                    // don't do anything if there isn't a unit defined
                    return;
                }
                var element = this.$el.find('#bbf-units');
                element.html(this.getUnitText());
            },

            templateData: function() {
                var initialData = Form.Field.prototype.templateData
                    .call(this);
                initialData['unitText'] = this.getUnitText();
                initialData['unit'] = this.unit;
                return initialData;
            },

            getUnitText: function() {
                if (!_.isEmpty(this.subUnits)) {
                    return _
                        .map(
                            _.keys(this.subUnits),
                            function(subUnit) {
                                return subUnit +
                                    ': ' + ((this.editor.getValue() || this.editor.value) *
                                            this.subUnits[subUnit]);
                            }, this).join(' ');
                } else {
                    // return empty string if there isn't a unit defined
                    return '';
                }
            }
        });

})(Backbone.Form);
