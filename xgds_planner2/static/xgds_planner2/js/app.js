
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
        //this.commandPresetsByCode = this.util.indexBy( this.planLibrary.commands, 'presetCode' );
        this.commandPresetsByName = this.util.indexBy( this.planLibrary.commands, 'name');
        this.commandPresetsByType = this.util.groupBy( this.planLibrary.commands, 'type');

        // Extract color from command specs
        // The app.colors object holds a key --> color map for the whole application
        this.colors = {};
        _.each( this.planSchema.commandSpecs, function(commandSpec){
            this.colors[commandSpec.id] = commandSpec.color;
        }, this );

        var planJson = JSON.parse( $('#plan_json').html() );
        if (planJson) {
            app.currentPlan = new app.models.Plan(planJson);
        }

        app.selectedViews = [];  // This array holds the views currently selected by checkboxes

        app.map = new app.views.EarthView({ el: '#map'});
        app.toolbar.show( new app.views.ToolbarView() );
        app.tabs.show( new app.views.TabNavView() );
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
     * Application-level Request & Respond services
    */

    // Return the color mapped to a given key.
    // If no color has been assigned to that key, allocate one to be forever associated with it.
    app.reqres.addHandler('getColor', function(key){
        var color;
        function allocateColor(){ return app.util.randomColor() } //TODO: replace this with something that draws from a list of non-horrible colors
        if ( ! app.colors ) { app.colors = {}; }
        if ( _.has(app.colors, key) ) {
            color = app.colors[key];
        } else {
            color = allocateColor();
            app.colors[key] = color;
        }
        return color;
    });

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
        groupBy: function(list, keyProp) {
            obj = {};
            _.each(list, function(item) {
                if ( _.isUndefined(obj[item[keyProp]]) ) { obj[item[keyProp]] = []; }
                obj[item[keyProp]].push(item);
            });
            return obj;
        },
        minutesToHMS: function(minutes){
            // given a floating point time duration in minutes, output "hh:mm:ss"
            var hh = Math.floor(minutes / 60);
            minutes = minutes - (hh*60.0);
            var mm = Math.floor(minutes);
            var ss = Math.floor( 60.0 * (minutes % 1) );
            var output = '';
            if ( hh > 0 ){
                output = output + '{hh:02d}:'.format({hh: hh});
            }
            output = output + '{mm:02d}:{ss:02d}'.format({ mm: mm, ss: ss });
            return output;
        },
        randomColor: function(){ return '#'+((1<<24)*Math.random()|0).toString(16) },
        rainbow: function (numOfSteps, step) {
            // This function generates vibrant, "evenly spaced" colours (i.e. no clustering). This is ideal for creating easily distiguishable vibrant markers in Google Maps and other apps.
            // Adam Cole, 2011-Sept-14
            // HSV to RBG adapted from: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
            // source: http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript/7419630
            var r, g, b;
            var h = step / numOfSteps;
            var i = ~~(h * 6);
            var f = h * 6 - i;
            var q = 1 - f;
            switch(i % 6){
                case 0: r = 1, g = f, b = 0; break;
                case 1: r = q, g = 1, b = 0; break;
                case 2: r = 0, g = 1, b = f; break;
                case 3: r = 0, g = q, b = 1; break;
                case 4: r = f, g = 0, b = 1; break;
                case 5: r = 1, g = 0, b = q; break;
            }
            var c = "#" + ("00" + (~ ~(r * 255)).toString(16)).slice(-2) + ("00" + (~ ~(g * 255)).toString(16)).slice(-2) + ("00" + (~ ~(b * 255)).toString(16)).slice(-2);
            return (c);
        },
    };




    return app;

}(jQuery, _, Backbone));


