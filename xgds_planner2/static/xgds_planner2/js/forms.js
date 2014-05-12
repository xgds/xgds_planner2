(function(Form) {
	Form.editors.Coordinates = Form.editors.Text.extend({
		/**
		 * Returns the current editor value
		 * @return {String}
		 */
		getValue : function() {
			var str = this.$el.val();
			var coords = str.split(',');
			var lng = parseFloat(coords[0]);
			var lat = parseFloat(coords[1]);
			return {
				type : 'Point',
				coordinates : [ lng, lat ]
			};
		},

		/**
		 * Sets the value of the form element
		 * @param {String} value
		 */
		setValue : function(value) {
			var lng = value.coordinates[0];
			var lat = value.coordinates[1];
			var str = '' + lng + ', ' + lat;
			this.$el.val(str);
		}

	});

	Form.editors.MinMaxNumber = Form.editors.Number
			.extend({
				initialize : function(options) {
					Form.editors.Number.prototype.initialize
							.call(this, options);
					this.minimum = _.isNumber(this.schema.minimum) ? this.schema.minimum
							: undefined;
					this.maximum = _.isNumber(this.schema.maximum) ? this.schema.maximum
							: undefined;
					this.strictMinimum = _.isBoolean(this.schema.strictMinimum) ? this.schema.strictMinimum
							: false;
					this.strictMaximum = _.isBoolean(this.schema.strictMaximum) ? this.schema.strictMaximum
							: false;
					if (_.isUndefined(this.maximum)
							&& _.isUndefined(this.minimum)) {
						console
								.warn('MinMaxField initialized without supplying a minimum or a maximum');

					}
				},

				validate : function() {
					var error = Form.editors.Number.prototype.validate
							.call(this);
					if (!_.isNull(error)) {
						return error;
					}
					if (_.isNumber(this.minimum)) {
						if (this.strictMinimum
								&& this.minimum >= this.getValue()) {
							error = {
								type : 'minimum',
								message : 'Value must be greater than '
										+ this.minimum
							};
						} else if (this.minimum > this.getValue()) {
							error = {
								type : 'minimum',
								message : 'Value must be greater than or equal to '
										+ this.minimum
							};
						}
					}
					if (_.isNumber(this.maximum)) {
						if (this.strictMaximum
								&& this.maximum <= this.getValue()) {
							error = {
								type : 'maximum',
								message : 'Value must be less than '
										+ this.maximum
							};
						} else if (this.maximum < this.getValue()) {
							error = {
								type : 'maximum',
								message : 'Value must be less than or equal to '
										+ this.minimum
							};
						}
					}
					return error;
				}
			});

	Form.UnitField = Form.Field
			.extend({

				initialize : function(options) {
					Form.Field.prototype.initialize.call(this, options);
					this.subUnits = {};
					if (this.schema.hasOwnProperty('unit')) {
						this.unit = this.schema.unit;
						if (!app.units.hasOwnProperty(this.schema.unit)) {
							console
									.warn('UnitField initialized with a unit not found in the plan schema: '
											+ this.schema.unit);
						} else {
							_
									.each(
											_
													.filter(
															_
																	.keys(app.unitSpecs[app.units[this.unit]].units),
															function(unit) {
																return unit != this.unit;
															}, this),
											function(subUnit) {
												this.subUnits[subUnit] = (app.unitSpecs[app.units[this.unit]].units[this.unit] / app.unitSpecs[app.units[this.unit]].units[subUnit]);
											}, this);
						}
					} else {
						this.unit = undefined;
					}
					this.template = Handlebars
							.compile($('#template-unit-field').html());
					this.listenTo(this.editor, 'change', this.updateUnits);
				},

				updateUnits : function() {
					if (_.isUndefined(this.unit)) {
						// don't do anything if there isn't a unit defined
						return;
					}
					var element = this.$el.find('#bbf-units');
					element.html(this.getUnitText());
				},

				templateData : function() {
					var initialData = Form.Field.prototype.templateData
							.call(this);
					initialData['unitText'] = this.getUnitText();
					initialData['unit'] = this.unit;
					return initialData;
				},

				getUnitText : function() {
					if (!_.isEmpty(this.subUnits)) {
						return _
								.map(
										_.keys(this.subUnits),
										function(subUnit) {
											return subUnit
													+ ': '
													+ ((this.editor.getValue() || this.editor.value) * this.subUnits[subUnit]);
										}, this).join(' ');
					} else {
						// return empty string if there isn't a unit defined
						return '';
					}
				}
			});

})(Backbone.Form);
