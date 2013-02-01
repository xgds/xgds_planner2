app.views = app.views || {};

app.views.EarthView = Backbone.View.extend({
    el: 'div',

    initialize: function(){
        var view = this;
        view.on('earth:loaded', view.render);
        google.load('earth', '1', {
            callback: function(){view.trigger('earth:loaded');}
        });
    },

   render: function(){
        google.earth.createInstance(this.el, this.earthInit, this.earthFailure);
    },

    earthInit: function(ge){
        this.ge = ge;
        ge.getWindow().setVisibility(true);
        app.vent.trigger("earth:loaded");
    },

    earthFailure: function(){
        alert("Earth plugin failed to load.");
    },

});

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',

});
