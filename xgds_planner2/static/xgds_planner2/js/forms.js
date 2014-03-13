(function(Form) {
    Form.editors.Coordinates = Form.editors.Text.extend({
        /**
        * Returns the current editor value
        * @return {String}
        */
        getValue: function() {
            var str = this.$el.val();
            var coords = str.split(',');
            var lng = parseFloat(coords[0]);
            var lat = parseFloat(coords[1]);
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
            var lng = value.coordinates[0];
            var lat = value.coordinates[1];
            var str = '' + lng + ', ' + lat;
            this.$el.val(str);
        }

    });

    Form.UnitField = Form.Field.extend({

        initialize: function(options) {
            Form.Field.prototype.initialize.call(this, options);
            this.template = Handlebars.compile($('#template-unit-field').html());
            this.listenTo(this.editor, 'change', this.updateUnits);
        },

        updateUnits: function() {
            if (!_.isFunction(this.editor.getUnitText)) {
                return;
            }
            var element = this.$el.find('#bbf-units');
            var unitText = this.editor.getUnitText();
            element.html(unitText);
        },

        templateData: function() {
            var schema = this.schema;
            var unitText = '';
            if (_.isFunction(this.editor.getUnitText)) {
                unitText = this.editor.getUnitText();
            }

            return {
                help: schema.help || '',
                title: schema.title,
                fieldAttrs: schema.fieldAttrs,
                editorAttrs: schema.editorAttrs,
                key: this.key,
                editorId: this.editor.id,
                unitText: unitText
            };
        }
    });

    Form.editors.UnitEditor = Form.editors.Number.extend({
        tagName: 'input',

        initialize: function(options) {
            Backbone.Form.editors.Number.prototype.initialize.call(this, options);
            this.unit = this.schema.unit;
            this.subUnits = {};
            if (!this.schema.hasOwnProperty('unit')) {
                // this should never happen
                throw 'UnitEditor initialized with a non-unit field';
            } else if (!app.units.hasOwnProperty(this.schema.unit)) {
                console.warn('UnitEditor initialized with a unit not found in the plan schema: ' + this.schema.unit);
            } else {
                _.each(_.filter(_.keys(app.unitSpecs[app.units[this.unit]].units), function(unit) {
                    return unit != this.unit;
                }, this), function(subUnit) {
                    this.subUnits[subUnit] = (app.unitSpecs[app.units[this.unit]].units[this.unit] /
                                              app.unitSpecs[app.units[this.unit]].units[subUnit]);
                }, this);
            }
        },

        getUnitText: function() {
            // reset help text
            var unitText = '';
            if (!_.isEmpty(this.subUnits)) {
                unitText = _.map(_.keys(this.subUnits), function(subUnit) {
                    return subUnit + ': ' + ((this.getValue() || this.value) * this.subUnits[subUnit]);
                }, this).join(' ');
            }
            return unitText;
        }
    });
})(Backbone.Form);

