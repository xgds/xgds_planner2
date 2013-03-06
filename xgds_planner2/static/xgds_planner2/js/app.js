
/*
** Override the TemplateCache function responsible for
** rendering templates so that it will use Handlebars.
*/
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(rawTemplate) {
  return Handlebars.compile(rawTemplate);
};


/*
** Main Application object
*/
var app = (function($, _, Backbone){
    app = new Backbone.Marionette.Application();

    app.addRegions({
        toolbar: '#toolbar',
        //map: '#map',
        'tabs': '#tabs',
    });

    app.addInitializer(function(options){

        this.options = options = _.defaults(options || {}, {
            readonly: false,
            planLineWidth: 2,
            plannerClampMode: undefined, // This enum value has to be sniffed out of the Plugin once it's loaded.
        });

        /*
        * Initialize the plan schema, and build easy-access indecies.
        * The plan schema is global to the planner deployment
        */
        this.planSchema = JSON.parse( $('#plan_schema_json').html() );
        this.planLibrary = JSON.parse( $('#plan_library_json').html() );

        // Indexes to make command types easier to retrieve.
        this.commandSpecs = this.util.indexBy( this.planSchema.commandSpecs, 'id' );
        this.commandPresetsByCode = this.util.indexBy( this.planLibrary.commands, 'typeCode' );

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

    /*
    ** Global utility functions
    */

    app.util = {
        indexBy: function( list, keyProp ) {
            // Return an object that indexes the objects in a list by their key property.
            // keyProp should be a string.
            obj = {};
            _.each(list, function(item) { obj[item[keyProp]] = item; });
            return obj;
        },
    };


    return app;

}(jQuery, _, Backbone));


