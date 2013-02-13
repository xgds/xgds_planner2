# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from geocamUtil import KmlUtil

from xgds_planner2.planExporter import TreeWalkPlanExporter
from xgds_planner2 import xpjson, settings


class KmlPlanExporter(TreeWalkPlanExporter):
    """
    Exports plan as KML string.
    """

    label = 'KML'
    content_type = 'application/vnd.google-earth.kml+xml'

    def transformStation(self, station, tsequence, context):
        lon, lat = station.geometry['coordinates']
        return ('''
<Placemark>
  <name>%(name)s</name>
  <Point>
    <coordinates>%(lon)s,%(lat)s</coordinates>
  </Point>
</Placemark>
''' % {'name': station.id,
       'lon': lon,
       'lat': lat})

    def transformSegment(self, segment, tsequence, context):
        plon, plat = context.prevStation.geometry['coordinates']
        nlon, nlat = context.nextStation.geometry['coordinates']
        mlon = 0.5 * (plon + nlon)
        mlat = 0.5 * (plat + nlat)
        return ('''
<Placemark>
  <name>%(name)s</name>
  <MultiGeometry>
    <Point>
      <coordinates>%(mlon)s,%(mlat)s</coordinates>
    </Point>
    <LineString>
      <tessellate>1</tessellate>
      <coordinates>
        %(plon)s,%(plat)s
        %(nlon)s,%(nlat)s
      </coordinates>
    </LineString>
  </MultiGeometry>
</Placemark>
''' % {'name': segment.id,
       'plon': plon,
       'plat': plat,
       'nlon': nlon,
       'nlat': nlat,
       'mlon': mlon,
       'mlat': mlat})

    def transformPlan(self, plan, tsequence, context):
        return KmlUtil.wrapKmlDocument('\n'.join(tsequence), plan.id)


schema = xpjson.loadDocument(xpjson.EXAMPLE_PLAN_SCHEMA_PATH)
plan = xpjson.loadDocument(xpjson.EXAMPLE_PLAN_PATH, schema=schema)
exporter = KmlPlanExporter()
open('/tmp/foo.kml', 'wb').write(exporter.exportPlan(plan))
