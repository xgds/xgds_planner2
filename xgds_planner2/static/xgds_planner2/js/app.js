
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(rawTemplate) {
  return Handlebars.compile(rawTemplate);
};


var app = (function($, _, Backbone){
    app = new Backbone.Marionette.Application();

    app.addRegions({
        toolbar: '#toolbar',
        //map: '#map',
        tabs: 'tabs'
    });

    app.addInitializer(function(options){
        app.map = new app.views.EarthView({ el: '#map'});
        app.toolbar.show(new app.views.ToolbarView);
    });
    
    return app;
}(jQuery, _, Backbone));


