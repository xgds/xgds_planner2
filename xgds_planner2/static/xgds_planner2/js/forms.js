
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

})(Backbone.Form);

