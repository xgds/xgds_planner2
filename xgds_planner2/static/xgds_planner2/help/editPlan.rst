
**Edit {{settings.XGDS_PLANNER_PLAN_MONIKER }}** lets you edit and simulate {{settings.XGDS_PLANNER_PLAN_MONIKER }}s

**{{settings.XGDS_PLANNER_PLAN_MONIKER }}** let you plan and simulate execution of a {{settings.XGDS_PLANNER_PLAN_MONIKER }}.
The map view is on the left and you can pan and zoom around the map.  The right hand side has tabs
which provide more detailed editing functionality.


Duration/Distance:
------------------

As you edit a {{settings.XGDS_PLANNER_PLAN_MONIKER }}, the overall duration and distance for the {{settings.XGDS_PLANNER_PLAN_MONIKER }}
will be reflected at the top of the page, in the timeline, and in the sequence.

Modes:
------
Buttons in the top left control the modes.

Navigate
	Pan and zoom around the map and explore the {{settings.XGDS_PLANNER_PLAN_MONIKER }} without modifying it (in the map).

Edit
	Modify existing elements of the {{settings.XGDS_PLANNER_PLAN_MONIKER }} on the map by clicking and dragging their points around.
	Note that even if you have just added elements you must click Edit to modify them.

	To delete a {{settings.XGDS_PLANNER_STATION_MONIKER}}, press the shift key while you click on it.

	To insert a new {{settings.XGDS_PLANNER_STATION_MONIKER}}, simply click on a {{settings.XGDS_PLANNER_SEGMENT_MONIKER}} and drag the blue dot.

Add
	Click to add {{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}} to the end of the {{settings.XGDS_PLANNER_PLAN_MONIKER }}


Undo/Redo:
----------

The undo and redo buttons in the top right will allow you to undo or redo edits you have made.  This will only be available during an edit session;
if you save and reopen the {{settings.XGDS_PLANNER_PLAN_MONIKER }} your change history will be lost.
You cannot undo a save, but you can undo edits and resave the {{settings.XGDS_PLANNER_PLAN_MONIKER }}.

Reload:
-------

The *Reload* button will allow you to reload the last saved version of the {{settings.XGDS_PLANNER_PLAN_MONIKER }}.  You will still be able to undo and redo.

Save As:
--------

To save the {{settings.XGDS_PLANNER_PLAN_MONIKER }} as a copy, click the *Save As* button.  A dialog will pop up allowing you to give the copy a new
name, version, and add some notes to it.

Save:
-----

Changes to the {{settings.XGDS_PLANNER_PLAN_MONIKER }} will not automatically save.  If you have made modifications, there will be a red *Unsaved changes*
indicator near the *Save* button.  If you have just clicked the *Save* button, your changes were saved.

{{settings.XGDS_PLANNER_PLAN_MONIKER }} Simulation:
---------------------------------------------------

Immediately under the buttons is a playback control and slider.  You can see when the vehicle will be at a given position by
simulating the {{settings.XGDS_PLANNER_PLAN_MONIKER }}.  Use the *Play* and *Pause* buttons to control the playback, and
modify the playback speed by changing the number to the right of the *Speed:* label.
You can also jump to a specific time by typing it in and clicking *Go:*
You can also control the simulated playback by dragging the square on the slider above the timeline.

Timeline:
---------

Below the playback slider is a timeline.  This shows the {{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}} including how long will be spent at each
{{settings.XGDS_PLANNER_STATION_MONIKER}}.  The currently selected {{settings.XGDS_PLANNER_STATION_MONIKER}} is highlighted in red.

Meta Tab:
---------

Grayed fields are not editable.

Name
	The name of the {{settings.XGDS_PLANNER_PLAN_MONIKER }}.

Notes
	The description of the {{settings.XGDS_PLANNER_PLAN_MONIKER }}, very useful for recording overall goals.

Plan Version
    A letter version for the {{settings.XGDS_PLANNER_PLAN_MONIKER }}.

Default Speed
    Used when simulating {{settings.XGDS_PLANNER_SEGMENT_MONIKER}} duration.

Sequence Tab:
-------------

We refer to the sequence of {{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}} and {{settings.XGDS_PLANNER_SEGMENT_MONIKER_PLURAL}} as a sequence.

{{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}}/{{settings.XGDS_PLANNER_SEGMENT_MONIKER_PLURAL}}
	The {{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}} and {{settings.XGDS_PLANNER_SEGMENT_MONIKER_PLURAL}} are listed by name in the leftmost column.
        For each {{settings.XGDS_PLANNER_STATION_MONIKER}}, the name and time of leaving the {{settings.XGDS_PLANNER_STATION_MONIKER}} is listed.
        For each {{settings.XGDS_PLANNER_SEGMENT_MONIKER}}, the distance and duration are listed.
        When you select a {{settings.XGDS_PLANNER_STATION_MONIKER}} or {{settings.XGDS_PLANNER_SEGMENT_MONIKER}},
        it is highlighted in green and its properties can be edited.

	Edit {{settings.XGDS_PLANNER_STATION_MONIKER}} Properties
		Click on the name of the {{settings.XGDS_PLANNER_STATION_MONIKER}}.  Its properties will show in the third column.  Note that when you are editing any properties, you must click away from the field to see the change reflected in the planner.

		Name
			The name of the {{settings.XGDS_PLANNER_STATION_MONIKER}}

		Notes
			Notes for the {{settings.XGDS_PLANNER_STATION_MONIKER}}, useful for detailed instruction

		Lon, Lat
			The longitude of the {{settings.XGDS_PLANNER_STATION_MONIKER}}, which can be edited or copied

		Tolerance
			A radius around the {{settings.XGDS_PLANNER_STATION_MONIKER}}

		Boundary
			A different radius around the {{settings.XGDS_PLANNER_STATION_MONIKER}}.

    Edit {{settings.XGDS_PLANNER_COMMAND_MONIKER_PLURAL}}
        {{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}} can contain {{settings.XGDS_PLANNER_COMMAND_MONIKER_PLURAL}}.
        To edit these:

          * Select the {{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}} by clicking on its name.
          * Click the blue *Add {{settings.XGDS_PLANNER_COMMAND_MONIKER}}* button at the bottom of the center column.
          * In the 3rd column you will see a list of  {{settings.XGDS_PLANNER_COMMAND_MONIKER_PLURAL}}.
          * To add one, click on it.
          * To modify a {{settings.XGDS_PLANNER_COMMAND_MONIKER}}'s properties, click on it in the 2nd column.
          * You can then edit its properties in the 3rd column.
          * The durations of the {{settings.XGDS_PLANNER_COMMAND_MONIKER_PLURAL}} are totaled at the top of the 2nd column, and used to compute the duration spent at the containing {{settings.XGDS_PLANNER_STATION_MONIKER}}.
          * To change the order of the {{settings.XGDS_PLANNER_COMMAND_MONIKER_PLURAL}} at a {{settings.XGDS_PLANNER_STATION_MONIKER}}, drag and drop them into the desired order.
          * To delete {{settings.XGDS_PLANNER_COMMAND_MONIKER_PLURAL}}, check the checkbox to the left of one or more and press the *Delete* button at the top of the 2nd column.
          * To copy {{settings.XGDS_PLANNER_COMMAND_MONIKER_PLURAL}} between {{settings.XGDS_PLANNER_STATION_MONIKER_PLURAL}}, select one or more with the checkbox, and press the *Copy* button.  Select the destination {{settings.XGDS_PLANNER_STATION_MONIKER}} and press the *Paste* button at the top of the 2nd column.

    Edit {{settings.XGDS_PLANNER_SEGMENT_MONIKER}} Properties
		Click on the distance of the {{settings.XGDS_PLANNER_SEGMENT_MONIKER}}.  Its properties will show in the third column.

		Name
			The name of the {{settings.XGDS_PLANNER_SEGMENT_MONIKER}}

		Notes
			Notes for the {{settings.XGDS_PLANNER_SEGMENT_MONIKER}}, useful for detailed instruction

		Speed
			Speed for the {{settings.XGDS_PLANNER_SEGMENT_MONIKER}}, used to calculate its duration.

Search Tab:
-----------
From the Search tab you can search for and view many other kinds of data in the map.

1. Select the type of data you are searching for in the dropdown and click the **Start** button.
2. A form will be displayed allowing you to filter what you are searching for.
3. Optionally fill that out and click the **Search** button.
4. Check the **Today** checkbox to limit results to those gathered today.
5. Results if any will be displayed below the form.
6. Select a result by clicking on it to see it in the map.

Tools Tab:
----------

  * *Reverse {{settings.XGDS_PLANNER_PLAN_MONIKER }}* by clicking the button to reverse the direction.
  * Append a {{settings.XGDS_PLANNER_PLAN_MONIKER }}
    * Select the {{settings.XGDS_PLANNER_PLAN_MONIKER }} to append from the dropdown
    * Select whether you want to place it before *Start* or after *End*
    * Check the box if you want to reverse the {{settings.XGDS_PLANNER_PLAN_MONIKER }} you are appending.
    * A connecting segment will automatically be inserted
    * Press *OK* to append it.

Links Tab:
----------

Click on any link to download the {{settings.XGDS_PLANNER_PLAN_MONIKER }} in the selected format.


.. |training_video| raw:: html

   <a href="https://xgds.org/downloads/training/xgds_planner/" target="_training">Training Video</a>

.. o __BEGIN_LICENSE__
.. o  Copyright (c) 2015, United States Government, as represented by the
.. o  Administrator of the National Aeronautics and Space Administration.
.. o  All rights reserved.
.. o
.. o  The xGDS platform is licensed under the Apache License, Version 2.0
.. o  (the "License"); you may not use this file except in compliance with the License.
.. o  You may obtain a copy of the License at
.. o  http://www.apache.org/licenses/LICENSE-2.0.
.. o
.. o  Unless required by applicable law or agreed to in writing, software distributed
.. o  under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
.. o  CONDITIONS OF ANY KIND, either express or implied. See the License for the
.. o  specific language governing permissions and limitations under the License.
.. o __END_LICENSE__
