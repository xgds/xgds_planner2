
/*
** Override the TemplateCache function responsible for
** rendering templates so that it will use Handlebars.
*/
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

        this.options = options = _.defaults(options,{
            readonly: false,
        });

        // The plan schema is global to the planner deployment
        app.planSchema = JSON.parse( $('#plan_schema_json').html() );
        app.planLibrary = JSON.parse( $('#plan_library_json').html() );
        var planJson = JSON.parse( $('#plan_json').html() );
        if (planJson) {
            app.currentPlan = new app.models.Plan(planJson);
        }

        app.map = new app.views.EarthView({ el: '#map'});
        app.toolbar.show( new app.views.ToolbarView );
        app.tabs.show( new app.views.TabNavView )
    });

    app.router = new Backbone.Router({
        routes:{
            "meta": "meta",
            "sequence": "sequence",
            "layers": "layers",
            "tools": "tools",
        },
    });


    
    /*
    ** Debug global event triggering.
    */
    app.router.on('all', function(eventname){
        console.log("Router event: "+eventname);
    });

    app.vent.on('all', function(eventname, args){
        console.log("event on app.vent: " + eventname, args);
    });

    app.addInitializer( _.bind(Backbone.history.start, Backbone.history) );

    return app;

}(jQuery, _, Backbone));


