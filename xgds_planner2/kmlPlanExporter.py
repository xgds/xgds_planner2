# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from geocamUtil import KmlUtil

from xgds_planner2.planExporter import TreeWalkPlanExporter
from xgds_planner2 import xpjson
import settings

class KmlPlanExporter(TreeWalkPlanExporter):
    """
    Exports plan as KML string.
    """

    label = 'kml'
    content_type = 'application/vnd.google-earth.kml+xml'

    def transformStation(self, station, tsequence, context):
        lon, lat = station.geometry['coordinates']
        name = station.name
        if not name:
            name = station.id
        return ('''
<Placemark>
  <name>%(name)s</name>
  <styleUrl>#station</styleUrl>
  <Point>
    <coordinates>%(lon)s,%(lat)s</coordinates>
  </Point>
</Placemark>
''' %
                {'name': name,
                 'lon': lon,
                 'lat': lat})

    def transformSegment(self, segment, tsequence, context):
        plon, plat = context.prevStation.geometry['coordinates']
        nlon, nlat = context.nextStation.geometry['coordinates']
        # mlon = 0.5 * (plon + nlon)
        # mlat = 0.5 * (plat + nlat)
        return ('''
<Placemark>
  <name>%(name)s</name>
  <styleUrl>#segment</styleUrl>
  <MultiGeometry>
    <LineString>
      <tessellate>1</tessellate>
      <coordinates>
        %(plon)s,%(plat)s
        %(nlon)s,%(nlat)s
      </coordinates>
    </LineString>
  </MultiGeometry>
</Placemark>
''' %
                {'name': segment.id,
                 'plon': plon,
                 'plat': plat,
                 'nlon': nlon,
                 'nlat': nlat})

    def makeStyles(self):
        waypointStyle = KmlUtil.makeStyle("station", "http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png", 0.85)
        directionStyle = KmlUtil.makeStyle("direction", "http://maps.google.com/mapfiles/kml/pal3/icon28.png", 0.85)
        segmentStyle = KmlUtil.makeStyle("segment", lineWidth=2)
        return waypointStyle + directionStyle + segmentStyle

    def transformPlan(self, plan, tsequence, context):
        return KmlUtil.wrapKmlDocument(self.makeStyles() + '\n'.join(tsequence), plan.get("id", ""))


def test():
    schema = xpjson.loadDocument(xpjson.EXAMPLE_PLAN_SCHEMA_PATH)
    plan = xpjson.loadDocument(xpjson.EXAMPLE_PLAN_PATH, schema=schema)
    exporter = KmlPlanExporter()
    open('/tmp/foo.kml', 'wb').write(exporter.exportPlan(plan, schema))


if __name__ == '__main__':
    test()
