#__BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#__END_LICENSE__

from geocamUtil import KmlUtil

from xgds_planner2.planExporter import TreeWalkPlanExporter
from xgds_planner2 import xpjson


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
        directionStyle = None
        styleUrl = 'station'
        result = ""
        try:
            if station.isDirectional:
                if station.headingDegrees:
                    headingDegrees = float(station.headingDegrees)
                    styleUrl = 'heading'
                    directionStyle = KmlUtil.makeStyle(iconHeading=headingDegrees)
        except AttributeError:
            pass
        result = result + ('''
<Placemark>
  <name>%s</name>
  <styleUrl>%s</styleUrl>''' % (name, styleUrl))
        if directionStyle:
            result = result + directionStyle
        result = result + ('''
  <Point>
    <coordinates>%(lon)s,%(lat)s</coordinates>
  </Point>
</Placemark>''' % {'lon': lon, 'lat': lat})
        return result

    def transformSegment(self, segment, tsequence, context):
        plon, plat = context.prevStation.geometry['coordinates']
        nlon, nlat = context.nextStation.geometry['coordinates']
        # mlon = 0.5 * (plon + nlon)
        # mlat = 0.5 * (plat + nlat)
        return ('''
<Placemark>
  <name>%(name)s</name>
  <styleUrl>segment</styleUrl>
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
        directionStyle = KmlUtil.makeStyle("heading", iconUrl="http://earth.google.com/images/kml-icons/track-directional/track-0.png")
        segmentStyle = KmlUtil.makeStyle("segment", lineWidth=2)
        return waypointStyle + directionStyle + segmentStyle

    def transformPlan(self, plan, tsequence, context):
        name = plan.get("name")
        if not name:
            name = plan.get("id", "")
        return KmlUtil.wrapKmlDocument(self.makeStyles() + '\n'.join(tsequence), name)


def test():
    schema = xpjson.loadDocument(xpjson.EXAMPLE_PLAN_SCHEMA_PATH)
    plan = xpjson.loadDocument(xpjson.EXAMPLE_PLAN_PATH, schema=schema)
    exporter = KmlPlanExporter()
    open('/tmp/foo.kml', 'wb').write(exporter.exportPlan(plan, schema))


if __name__ == '__main__':
    test()
