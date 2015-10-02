var xgds_map = xgds_map || {};

xgds_map.initUploadJson = function(el) {
	var my_el = el;
	var uploadButton = my_el.find("#uploadJsonButton");
	var theform = my_el.find("#UploadXPJsonForm");
	uploadButton.click(function(event) {
	 event.preventDefault();
     var postData = new FormData(theform[0]);
	 $.ajax({
                url: "/xgds_planner2/import/xpjson/", //{% url 'planner2_planImport_xpjson' %}",
                type: "POST",
                data: postData,
                contentType: false,
                processData: false,
                dataType: 'json',
                success: function(data)
                {
                	my_el.find('#message').text("JSON updated; reloading");
                    location.reload();
                },
                error: $.proxy(function(data){
                	my_el.find('#message').text(data.responseJSON.responseText);	
                }, this)
            });
 });
}