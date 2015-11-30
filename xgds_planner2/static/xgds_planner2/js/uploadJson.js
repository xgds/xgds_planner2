//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

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