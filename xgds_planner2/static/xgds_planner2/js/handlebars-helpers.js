//
// Handlebars Template Helpers
//

// debug: prints the current template context, and optionally
// a specified value, to the console.
Handlebars.registerHelper("debug", function(optionalValue) {
  console.log("Current Context");
  console.log("====================");
  console.log(this);
 
  if (optionalValue) {
    console.log("Value");
    console.log("====================");
    console.log(optionalValue);
  }
});

//
// Conditional that compares two values
//
Handlebars.registerHelper('ifequal', function (val1, val2, options) {
    if (val1 === val2) {
        return options.fn();
    }
    else {
        return options.inverse();
    }
});

Handlebars.registerHelper('getattr', function(obj, key) {
    return obj[key];
});
