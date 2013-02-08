
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(rawTemplate) {
  return Handlebars.compile(rawTemplate);
};


var app = (function($, _, Backbone){
    app = new Backbone.Marionette.Application();

    app.addRegions({
        toolbar: '#toolbar',
        //map: '#map',
        'tabs': '#tabs',
    });

    app.addInitializer(function(options){

        // The plan schema is global to the planner deployment
        app.planSchema = JSON.parse( $('#plan_schema_json').html() );

        app.map = new app.views.EarthView({ el: '#map'});
        app.toolbar.show( new app.views.ToolbarView );
        app.tabs.show( new app.views.TabNavView )
    });
    
    return app;
}(jQuery, _, Backbone));


