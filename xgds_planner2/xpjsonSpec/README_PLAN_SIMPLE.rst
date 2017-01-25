
=========================================================================
The Exploration Plan JSON (XPJSON) Plan Format Specification (SIMPLIFIED)
=========================================================================

Authors
  | Trey Smith (NASA Ames Research Center)
  | Tamar Cohen (NASA Ames Research Center)
  | David Lees (Carnegie Mellon University)
  | Ted Scharff (NASA Ames Research Center)

Revision
  0.2

Date
  11/20/2015

Canonical URL of this document
  TBD

Further information
  TBD

.. contents::
   :depth: 2

.. sectnum::

Introduction
============

Exploration Plan JSON (XPJSON) is a JSON format for specifying a
single-timeline command sequence. XPJSON plans typically include
position and time information (actions with spatial coordinates,
modeling duration of activities).

Altogether, the XPJSON specification defines formats for three companion
document types:

 * Plan_: A plan is a command sequence and associated meta-data.

Examples
========

An XPJSON Plan_::

  {
    "xpjson": "0.2",
    "type": "Plan",

    "name": "Marscape Traverse",
    "notes": "A simple drive",
    "planNumber": 1,
    "planVersion": "A",
    "id": "ARC_R001A",

    "creator": "John Doe",
    "dateCreated": "2012-03-01T10:05:07Z",
    "dateModified": "2012-03-02T11:23:15Z",

    "schemaUrl": "http://example.com/robotScienceSchema.json",
    "libraryUrls": [
      "http://example.com/robotScienceLibrary.json"
    ],

    "site": {
      "type": "Site",
      "name": "NASA Ames Marscape",
      "id": "ARC",
      "crs": {
        "type": "name",
        "properties": {
          "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
      }
    },

    "platform": {
      "type": "Platform",
      "name": "K10 Red",
      "id": "R"
    },

    "sequence": [
      {
        "type": "Station",
        "name": "Rover Staging Area",
        "id": "00",
        "geometry": {
          "type": "Point",
          "coordinates": [-122.065483, 37.416433]
        }
      },
      {
        "type": "Segment",
        "id": "01",
        "tolerance": 0.5,
        "speed": 0.3,
        "sequence": [
        ]
      },
      {
        "type": "Station",
        "name": "Waypoint 1",
        "id": "02",
        "geometry": {
          "type": "Point",
          "coordinates": [-122.065585, 37.416379]
        },
        "sequence": [
        ]
      },
      {
        "type": "Segment",
        "id": "03",
        "tolerance": 1.0,
        "speed": 0.7
      },
      {
        "type": "Station",
        "name": "Waypoint 2",
        "id": "04",
        "geometry": {
          "type": "Point",
          "coordinates": [-122.065639,  37.416503]
        }
      }
    ]
  }

Definitions
===========

 * The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
   "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this
   document are to be interpreted as described in `IETF RFC 2119`_.

 * JavaScript Object Notation (JSON), and the terms "object", "name", "value",
   "array", and "number", are defined in `IETF RTC 4627`_.  XPJSON
   documents have the standard JSON MIME type, "application/json".

.. _IETF RFC 2119: http://www.ietf.org/rfc/rfc2119.txt
.. _IETF RTC 4627: http://www.ietf.org/rfc/rfc4627.txt

Class Hierarchy
===============

The JavaScript objects that make up XPJSON plan documents fit into a class
hierarchy as follows:

 * TypedObject_

   * Command_

     * `Command Subclasses`_ (as defined by the schema)

   * Document_

     * Plan_

   * ParamSpec_

   * PathElement_

     * Segment_

     * Station_

   * Platform_

   * Site_

   * Target_

JavaScript objects are collections of name/value pairs where the names
are strings.

In a Dictionary instance, the names in the name/value pairs are
arbitrary. When we say a "Dictionary of X" we mean a Dictionary where
all the values are instances of the same type X (or subclasses of X).

Subclasses of TypedObject_ have named members with pre-defined meanings.

.. _TypedObject:

TypedObject Class
~~~~~~~~~~~~~~~~~

A TypedObject instance has a ``type`` member that states which class it
belongs to. The definition of that class specifies the name, type, and
interpretation of other members.

Abstract class:
  Yes

Inherits from:
  (none)

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``type``          |string          |optional         |The name of the class this object   |
|                  |                |                 |belongs to.                         |
+------------------+----------------+-----------------+------------------------------------+
|``name``          |string          |optional         |Name. If the object is exposed to   |
|                  |                |                 |the user in the planning interface, |
|                  |                |                 |this is generally the text label the|
|                  |                |                 |user sees.                          |
+------------------+----------------+-----------------+------------------------------------+
|``notes``         |string          |optional         |Free-form notes about the object.   |
|                  |                |                 |                                    |
|                  |                |                 |Notes about objects in the          |
|                  |                |                 |PlanSchema_ and PlanLibrary_ may be |
|                  |                |                 |displayed as explanatory text in the|
|                  |                |                 |planning interface.                 |
|                  |                |                 |                                    |
|                  |                |                 |Users of the planning interface     |
|                  |                |                 |should be able to attach notes to   |
|                  |                |                 |the objects they edit in the Plan_  |
|                  |                |                 |(including Stations, Segments,      |
|                  |                |                 |Targets, Commands, and the Plan     |
|                  |                |                 |itself).                            |
+------------------+----------------+-----------------+------------------------------------+
|``id``            |string          |optional         |Identifier.                         |
|                  |                |                 |                                    |
|                  |                |                 |In some applications, the ``id`` is |
|                  |                |                 |part of a formal naming convention. |
|                  |                |                 |For example, the ``id`` of a command|
|                  |                |                 |might include ids from the site, the|
|                  |                |                 |plan, and the station that it is    |
|                  |                |                 |part of. Note that, depending on the|
|                  |                |                 |naming convention, the id of an     |
|                  |                |                 |object might automatically change if|
|                  |                |                 |the sequence that contains it is    |
|                  |                |                 |reordered.                          |
|                  |                |                 |                                    |
|                  |                |                 |For PlanSchema_ and PlanLibrary_    |
|                  |                |                 |documents, we suggest using the     |
|                  |                |                 |canonical URL of the document as the|
|                  |                |                 |``id``.                             |
+------------------+----------------+-----------------+------------------------------------+
|``uuid``          |string          |optional         |Universally unique identifier for   |
|                  |                |                 |the given object.                   |
|                  |                |                 |                                    |
|                  |                |                 |In contrast to the ``id`` value, the|
|                  |                |                 |``uuid`` value must persist when the|
|                  |                |                 |object is edited or the sequence    |
|                  |                |                 |that contains it is reordered. The  |
|                  |                |                 |``uuid`` field was created in order |
|                  |                |                 |to provide this persistence,        |
|                  |                |                 |especially to maintain object       |
|                  |                |                 |identity when exchanging plans      |
|                  |                |                 |between different planning systems. |
|                  |                |                 |                                    |
|                  |                |                 |If an object is copied, the copy    |
|                  |                |                 |must be assigned a new UUID to      |
|                  |                |                 |maintain uniqueness.                |
|                  |                |                 |                                    |
|                  |                |                 |For simplicity, we recommend using a|
|                  |                |                 |Version 4 (randomly generated) UUID.|
+------------------+----------------+-----------------+------------------------------------+
|``derivedInfo``   |object          |optional         |A place to put unstructured         |
|                  |                |                 |"derived" information about objects |
|                  |                |                 |in the plan.                        |
|                  |                |                 |                                    |
|                  |                |                 |Its primary purpose is for          |
|                  |                |                 |exchanging extra information between|
|                  |                |                 |different planning systems. For     |
|                  |                |                 |example, if system A has a model for|
|                  |                |                 |calculating expected duration of    |
|                  |                |                 |travel along a Segment_, it can     |
|                  |                |                 |store the model results in the      |
|                  |                |                 |``derivedInfo`` field of each       |
|                  |                |                 |Segment at plan export, making them |
|                  |                |                 |available to system B.              |
|                  |                |                 |                                    |
|                  |                |                 |This field should only store        |
|                  |                |                 |"non-precious" information about the|
|                  |                |                 |plan that was calculated by a       |
|                  |                |                 |planning tool rather than entered by|
|                  |                |                 |a user, and that can be regenerated |
|                  |                |                 |from other fields if needed.        |
|                  |                |                 |                                    |
|                  |                |                 |Its value is an unstructured object,|
|                  |                |                 |i.e., its contents are not described|
|                  |                |                 |in the PlanSchema_. As a result,    |
|                  |                |                 |planning interfaces may not support |
|                  |                |                 |user inspection or editing of the   |
|                  |                |                 |contents.                           |
+------------------+----------------+-----------------+------------------------------------+

.. _Command:

Command Class
~~~~~~~~~~~~~

A Command instance is an element of an XPJSON command sequence.

Abstract class:
  Yes

Inherits from:
  TypedObject

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``name``           |string          |optional         |The text label to use in the        |
|                   |                |                 |planning interface for this command.|
|                   |                |                 |                                    |
|                   |                |                 |If not specified, defaults to a     |
|                   |                |                 |prettified version of the ``id``    |
|                   |                |                 |member. What it means to "prettify" |
|                   |                |                 |the ``id`` really depends on the    |
|                   |                |                 |format of the ``id``, which varies  |
|                   |                |                 |from application to application. For|
|                   |                |                 |example, the ``id`` might be        |
|                   |                |                 |shortened for display by removing a |
|                   |                |                 |common prefix that appears in all   |
|                   |                |                 |commands belonging to a particular  |
|                   |                |                 |plan.                               |
+-------------------+----------------+-----------------+------------------------------------+
|``id``             |string          |required         |Identifier for the command.         |
|                   |                |                 |                                    |
|                   |                |                 |Probably auto-generated by the      |
|                   |                |                 |planning interface according to a   |
|                   |                |                 |naming convention.                  |
+-------------------+----------------+-----------------+------------------------------------+
|``uuid``           |string          |required         |Persistent universally unique       |
|                   |                |                 |identifier for the command.         |
|                   |                |                 |                                    |
|                   |                |                 |Typically a Version 4 UUID randomly |
|                   |                |                 |generated by the planning interface.|
+-------------------+----------------+-----------------+------------------------------------+
|``stopCommandUuid``|string          |optional         |Identifies an earlier non-blocking  |
|                   |                |                 |command to stop by its ``uuid``.    |
|                   |                |                 |                                    |
|                   |                |                 |Used only if ``isStopCommand`` is   |
|                   |                |                 |``true`` for this command subclass. |
+-------------------+----------------+-----------------+------------------------------------+
|``stopCommandType``|string          |optional         |Identifies an earlier non-blocking  |
|                   |                |                 |command to stop by its ``type``.    |
|                   |                |                 |                                    |
|                   |                |                 |Used only if ``isStopCommand`` is   |
|                   |                |                 |``true`` for this command subclass. |
+-------------------+----------------+-----------------+------------------------------------+

Command Subclasses
~~~~~~~~~~~~~~~~~~

Each CommandSpec_ object in the PlanSchema_ defines a new subclass of
the Command_ class. Instances of these subclasses may appear in the
``sequence`` member of a Plan_, Station_, or Segment_ object.

The subclasses are arranged in their own class hierarchy, with
inheritance relationships specified by the ``parent`` member. Abstract
subclasses exist only to act as parents of other classes and must not be
used in a Plan_.

The PlanSchema_ designer can control how much flexibility is offered in
the planning interface. There are several possible conventions for a
schema:

 * Maximum flexibility: Allow users to set arbitrary values for
   parameters.  (These values can be limited to fall within a certain
   range via the ``minimum`` and ``maximum`` members.)

 * Per-parameter choices: Restrict users to a limited range of choices
   for each parameter using the ``choices`` member.

 * Command presets: Sometimes we want to pre-define a collection of presets
   for a command, where each preset sets most or all of the parameter
   values for the command. Restricting users to choose from among these
   presets has some advantages in terms of allowing the schema
   designer to choose descriptive names for the presets ("wide low-res
   panorama", "narrow high-res panorama"), and allowing each preset to
   be thoroughly tested before deployment, for example to empirically
   measure the average time it takes to execute. To use presets:

   * Place the presets in the ``commands`` section of the
     PlanLibrary_.

   * Once the user has chosen a preset in the planning interface, their
     ability to further edit the parameter values set by the preset is
     controlled by the ``editable`` member of each ParamSpec_, so the
     plan schema designer can choose how much flexibility to grant the
     user.

Example
-------

Example instance of a "DriveForward" subclass::

  {
    // inherited from TypedObject
    "type": "DriveForward",
    "name": "Drive 1",
    "notes": "-",
    "id": "ARC_R001A00_0_FWD",
    "uuid": "46b5a8f5-d5bd-4fe8-a493-99c29d088bce",

    // inherited from Command
    "stationId": "ARC_R001A00",

    // defined in DriveForward CommandSpec
    "distance": 0.5,
    "speed": 0.1
  }

The instance conforms to this CommandSpec_ in the PlanSchema_::

  {
    "type": "CommandSpec",
    "name": "DriveForward",
    "id": "FWD",
    "notes": "Drive forward",
    "parent": "Command",
    "params": [
      {
        "type": "ParamSpec",
        "id": "distance",
        "name": "distance (meters)",
        "valueType": "number"
      },
      {
        "type": "ParamSpec",
        "id": "speed",
        "name": "speed (m/s)",
        "valueType": "number"
      }
    ]
  }

.. _Document:

Document Class
~~~~~~~~~~~~~~

Document is the parent class for top-level document nodes in XPJSON
Plan_ documents.

Abstract class:
  Yes

Inherits from:
  TypedObject

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``xpjson``        |string          |"0.2"            |Indicates this is an XPJSON document|
|                  |                |                 |(a Plan_, PlanSchema_, or           |
|                  |                |                 |PlanLibrary_). Specifies what       |
|                  |                |                 |version of the XPJSON spec the      |
|                  |                |                 |document conforms to.               |
+------------------+----------------+-----------------+------------------------------------+
|``subject``       |array of string |optional         |Subjects covered by the             |
|                  |                |                 |document. These are probably        |
|                  |                |                 |user-defined tags.                  |
+------------------+----------------+-----------------+------------------------------------+
|``creator``       |string          |optional         |The entity primarily responsible for|
|                  |                |                 |creating the document.              |
+------------------+----------------+-----------------+------------------------------------+
|``contributors``  |array of string |optional         |Other entities that contributed to  |
|                  |                |                 |the document.                       |
+------------------+----------------+-----------------+------------------------------------+
|``dateCreated``   |date-time       |optional         |The time when the document was      |
|                  |                |                 |created.                            |
+------------------+----------------+-----------------+------------------------------------+
|``dateModified``  |date-time       |optional         |The time when the document was last |
|                  |                |                 |modified.                           |
+------------------+----------------+-----------------+------------------------------------+

.. _PathElement:

PathElement Class
~~~~~~~~~~~~~~~~~

A PathElement instance is part of the geometry of the Plan_ and it can
contain commands in its ``sequence`` member.

Abstract class: Yes

Inherits from:
  TypedObject

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``sequence``      |array containing|optional         |A sequence of commands that should  |
|                  |Command_ entries|                 |be executed at or along this        |
|                  |                |                 |PathElement.                        |
|                  |                |                 |                                    |
|                  |                |                 |If not specified, the default       |
|                  |                |                 |interpretation is an empty sequence.|
+------------------+----------------+-----------------+------------------------------------+
|``uuid``          |string          |required         |Persistent universally unique       |
|                  |                |                 |identifier.                         |
|                  |                |                 |                                    |
|                  |                |                 |Typically a Version 4 UUID randomly |
|                  |                |                 |generated by the planning interface.|
+------------------+----------------+-----------------+------------------------------------+

.. _Plan:

Plan Class
~~~~~~~~~~

A Plan instance is the top level object of an XPJSON plan document.

Additional members in the Plan_ class may be specified in the
``planParams`` member of the PlanSchema_.

Abstract class:
  No

Inherits from:
  TypedObject

+--------------------+-------------+----------------+------------------------------------+
|Member              |Type         |Values          |Meaning                             |
+====================+=============+================+====================================+
|``schemaUrl``       |string       |optional        |URL of the PlanSchema_ this Plan_   |
|                    |             |                |conforms to.                        |
+--------------------+-------------+----------------+------------------------------------+
|``libraryUrls``     |array of     |optional        |URLs of any PlanLibrary_ documents  |
|                    |string       |                |whose elements were available in the|
|                    |             |                |planning interface when this Plan_  |
|                    |             |                |was generated.                      |
+--------------------+-------------+----------------+------------------------------------+
|``planNumber``      |integer      |optional        |The number of this Plan_, if there  |
|                    |             |                |is a plan numbering scheme.         |
|                    |             |                |                                    |
|                    |             |                |This number might be set by the user|
|                    |             |                |or it might be auto-incremented by  |
|                    |             |                |the planning interface.             |
+--------------------+-------------+----------------+------------------------------------+
|``planVersion``     |string       |optional        |The version of the Plan_, if there  |
|                    |             |                |is a plan numbering scheme.         |
|                    |             |                |                                    |
|                    |             |                |If the Plan_ with a particular      |
|                    |             |                |``planNumber`` is updated and saved |
|                    |             |                |multiple times, the versions might  |
|                    |             |                |be marked ``"A"``, ``"B"``, ``"C"``,|
|                    |             |                |etc.                                |
+--------------------+-------------+----------------+------------------------------------+
|``site``            |Site_        |optional        |The operating area where this plan  |
|                    |             |                |will be executed.                   |
+--------------------+-------------+----------------+------------------------------------+
|``platform``        |Platform_    |optional        |The entity that will execute this   |
|                    |             |                |plan.                               |
+--------------------+-------------+----------------+------------------------------------+
|``targets``         |array of     |optional        |Target_ objects that can be         |
|                    |Target_      |                |referenced by stations or segments. |
+--------------------+-------------+----------------+------------------------------------+
|``sequence``        |array        |required        |The command sequence.               |
|                    |containing   |                |                                    |
|                    |Command_,    |                |                                    |
|                    |Station_, and|                |                                    |
|                    |Segment_     |                |                                    |
|                    |elements     |                |                                    |
|                    |             |                |                                    |
+--------------------+-------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Plan",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from Document
    "xpjson": "0.2",
    "subject": [
      "(tag 1)",
      ...
    ],
    "creator": "(creator)",
    "contributors": [
      "(contributor 1)",
      ...
    ],
    "dateCreated": "2012-03-01T10:05:07Z",
    "dateModified": "2012-03-02T11:23:15Z",

    // defined in Plan
    "schemaUrl": "(PlanSchema document URL)",
    "libraryUrls": [
      "(PlanLibrary document URL 1)",
      ...
    ],
    "planNumber": (Plan number),
    "planVersion": "(Plan version)",
    "site": { (Site) },
    "targets": [
      { (Target 1) },
      ...
    ],
    "sequence": [
      { (Sequence element 1) },
      ...
    ]
  }

.. _ParamSpec:

ParamSpec Class
~~~~~~~~~~~~~~~

A ParamSpec (or parameter specification) describes a parameter that can be included in a Plan_, PathElement_, or Command_.
This includes definitions of options used to describe, render and verify the parameter.

Inherits from:
  TypedObject

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``valueType``     |string          |required         |The type of value for the parameter.|
|                  |                |                 |Options include: ``string``         |
|                  |                |                 |``integer`` ``number`` ``boolean``  |
|                  |                |                 |``date-time`` ``targetId``,``h:m:s``|
+------------------+----------------+-----------------+------------------------------------+
|``unit``          |string          |optional         |Parameter's displayed unit value.   |
+------------------+----------------+-----------------+------------------------------------+
|``default``       |valid json      |optional         |Default parameter value.            |
+------------------+----------------+-----------------+------------------------------------+
|``choices``       |array of name,  |optional         |For an enumerated parameter with a  |
|                  |value arrays    |                 |select dropdown, provide choices.   |
+------------------+----------------+-----------------+------------------------------------+
|``widget``        |string          |optional         |The type of widget to create for    |
|                  |                |                 |parameter editing. Options include: |
|                  |                |                 |``text`` ``number`` ``checkbox``    |
|                  |                |                 |``datetime`` ``select`` ``textarea``|
|                  |                |                 |``h:m:s``                           |
|                  |                |                 |might include ids from the site, the|
|                  |                |                 |plan, and the station that it is    |
|                  |                |                 |part of. Note that, depending on the|
|                  |                |                 |naming convention, the id of an     |
|                  |                |                 |object might automatically change if|
|                  |                |                 |the sequence that contains it is    |
|                  |                |                 |reordered.                          |
|                  |                |                 |                                    |
|                  |                |                 |For PlanSchema_ and PlanLibrary_    |
|                  |                |                 |documents, we suggest using the     |
|                  |                |                 |canonical URL of the document as the|
|                  |                |                 |``id``.                             |
+------------------+----------------+-----------------+------------------------------------+
|``visible``       |boolean         |optional         |To have a hidden parameter, set the |
|                  |                |                 |visible value to false.             |
+------------------+----------------+-----------------+------------------------------------+
|``minimum``       |number          |optional         |The minimum valid parameter value.  |
+------------------+----------------+-----------------+------------------------------------+
|``maximum``       |number          |optional         |The maximum valid parameter value.  |
+------------------+----------------+-----------------+------------------------------------+
|``multipleOf``    |number          |optional         |A number that the parameter must be |
|                  |                |                 |an exact multiple of.  Also requires|
|                  |                |                 |minimum or maximum.                 |
+------------------+----------------+-----------------+------------------------------------+
|``onChange``      |string          |optional         |A string containing a javascript    |
|                  |                |                 |function which will be invoked when |
|                  |                |                 |the parameter changes.  Function    |
|                  |                |                 |arguments are model, value, event.  |
+------------------+----------------+-----------------+------------------------------------+

Example
-------

::

   {
	    "type": "ParamSpec",
	    "id": "defaultSpeed",
	    "valueType": "number",
        "unit": "meters/sec",
	    "notes": "The default speed for traverses",
	    "required": false,
	    "name": "Default Speed",
	    "default": 0.025,
	    "widget":"number"
	},
	{
        "type": "ParamSpec",
        "id": "whiteBalance",
        "choices": [["Auto", "Auto"],
                    ["Daylight", "Daylight"],
                    ["Cloudy", "Cloudy"],
                    ["Tungsten", "Tungsten"],
                    ["Fluorescent", "Fluorescent"]],
        "valueType": "string",
        "notes": "Camera white balance setting.  Normally use 'Auto' when taking single frames."
     }
	


.. _Platform:

Platform Class
~~~~~~~~~~~~~~

A Platform instance describes an entity that can execute a plan. This might
be a person, a robot, or a team.

Abstract class:
  No

Inherits from:
  TypedObject

(No additional fields beyond those specified in TypedObject.)

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Platform",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)"
    "uuid": "(uuid)",
    "derivedInfo": { ... },
  }

.. _Segment:

Segment Class
~~~~~~~~~~~~~

A Segment instance is an element of the command sequence that represents
motion along a path. A Segment can contain a sequence of commands which
should be executed during motion.

In some applications, the motion commands that cause the platform to
move along the Segment are implicit: the executive infers that motion is
required from the existence of the Segment and issues the necessary
commands automatically.

If the user needs the ability to specify parameters that change the
behavior of implicit motion commands, this can be enabled by adding the
parameters to the Segment class using the ``segmentParams`` member of
the PlanSchema_.

Implicit motion commands should be executed as blocking
commands *after* any commands found in the ``sequence`` member. That
way, any non-blocking commands in ``sequence`` are started before motion
occurs (and stopped automatically when motion along the Segment ends).

In other applications, the planning interface may insert explicit motion
commands in the ``sequence`` member. The executive then treats the
sequence like any other.

Abstract class:
  No

Inherits from:
  PathElement_

+------------------+------------+----------------+------------------------------------+
|Member            |Type        |Values          |Meaning                             |
+==================+============+================+====================================+
|``geometry``      |LineString  |optional        |For many applications this field is |
|                  |(see        |                |always unspecified and the implicit |
|                  |`GeoJSON    |                |geometry of the Segment is the      |
|                  |geometry`_) |                |LineString connecting the Stations  |
|                  |            |                |that bracket the segment.           |
|                  |            |                |                                    |
|                  |            |                |In some domains, the user may want  |
|                  |            |                |to specify a detailed path between  |
|                  |            |                |Segments by providing an explicit   |
|                  |            |                |LineString geometry. (But planning  |
|                  |            |                |interfaces are not required to      |
|                  |            |                |support editing the Segment         |
|                  |            |                |geometry.)                          |
+------------------+------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Segment",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from PathElement
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-122, 37],
        [-122, 36],
        [-121, 36]
      ]
    },
    "sequence": [
      { (Command 1) },
      ...
    ]
  }

.. _Site:

Site Class
~~~~~~~~~~

A Site instance is an operating area where a plan can be executed. Each
site may have its own associated coordinate frames.

Abstract class:
  No

Inherits from:
  TypedObject

+------------------+-----------+----------------+------------------------------------+
|Member            |Type       |Values          |Meaning                             |
+==================+===========+================+====================================+
|``crs``           |CRS object |optional        |Geometry coordinates in the plan are|
|                  |           |                |expressed in this coordinate        |
|                  |           |                |reference system.  See the `GeoJSON |
|                  |           |                |CRS specification`_.                |
|                  |           |                |                                    |
|                  |           |                |The default CRS is OGC CRS84, a     |
|                  |           |                |geographic coordinate reference     |
|                  |           |                |system, using the WGS84 datum, in   |
|                  |           |                |[longitude, latitude] order with    |
|                  |           |                |units of decimal degrees.           |
|                  |           |                |                                    |
|                  |           |                |We normally use CRS84 for plans to  |
|                  |           |                |be executed in outdoor environments |
|                  |           |                |on Earth where GPS is available. In |
|                  |           |                |other environments (e.g. lunar      |
|                  |           |                |surface, inside ISS), a different   |
|                  |           |                |CRS may be required.                |
+------------------+-----------+----------------+------------------------------------+
|``alternateCrs``  |CRS object |optional        |An alternate coordinate reference   |
|                  |           |                |system, usually a local frame for   |
|                  |           |                |the site, which users of a planning |
|                  |           |                |interface may need to work with.    |
|                  |           |                |                                    |
|                  |           |                |Ideally, planning interfaces should |
|                  |           |                |be able to transform plan geometry  |
|                  |           |                |coordinates into the alternate CRS, |
|                  |           |                |display the resulting coordinate    |
|                  |           |                |values, and allow users to edit them|
|                  |           |                |in that format to be transformed    |
|                  |           |                |back into the primary CRS for       |
|                  |           |                |storage.                            |
|                  |           |                |                                    |
|                  |           |                |Other useful features would include |
|                  |           |                |a map reference grid and cursor     |
|                  |           |                |coordinate display in the alternate |
|                  |           |                |CRS.                                |
+------------------+-----------+----------------+------------------------------------+
|``bbox``          |array of   |optional        |A bounding box around the site that |
|                  |numbers    |                |can also serve as the initial map   |
|                  |           |                |view when creating a new plan.      |
|                  |           |                |Format defined by the `GeoJSON      |
|                  |           |                |bounding box specification`_.       |
+------------------+-----------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Site",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // defined in Site
    "crs": {
      "type": "name",
      "properties": {
        "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
      }
    },
    "bbox": [-180, -90, 180, 90]
  }

.. _Station:

Station Class
~~~~~~~~~~~~~

A Station instance is an element of the command sequence that represents
a named location where the platform may stop to execute commands.

Additional members in the Station_ class may be specified in the
``stationParams`` member of the PlanSchema_.

Abstract class:
  No

Inherits from:
  PathElement_

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``geometry``       |Point geometry  |required         |The location of the station.        |
|                   |(see `GeoJSON   |                 |                                    |
|                   |geometry`_)     |                 |                                    |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Station",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from PathElement
    "geometry": {
      "type": "Point",
      "coordinates": [-122, 37]
    }
    "sequence": [
      { (Command 1) },
      ...
    ]
  }

.. _Target:

Target Class
~~~~~~~~~~~~

A Target instance is a named geometric object that can be referenced by
a PathElement_. Targets are usually used as annotations that explain plan
objectives but do not change the execution semantics.

Additional members in the Target_ class may be specified in the
``targetParams`` member of the PlanSchema_.

Abstract class:
  No

Inherits from:
  TypedObject

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``geometry``       |Point (see      |required         |The location of the Target.         |
|                   |`GeoJSON        |                 |                                    |
|                   |geometry`_)     |                 |                                    |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Target",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // defined in Target
    "geometry": {
      "type": "Point",
      "coordinates": [-122, 37]
    }
  }

.. _GeoJSON CRS specification: http://geojson.org/geojson-spec.html#coordinate-reference-system-objects

.. _GeoJSON bounding box specification: http://geojson.org/geojson-spec.html#bounding-boxes

.. _GeoJSON geometry: http://geojson.org/geojson-spec.html#geometry-objects

.. _ISO 8601: http://www.w3.org/TR/NOTE-datetime

.. _Python String Formatting: http://docs.python.org/3/library/string.html#formatstrings

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
