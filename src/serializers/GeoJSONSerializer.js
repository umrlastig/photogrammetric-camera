export default {
    /** @module GeoJSONSerializer */

    /** Parse an orientation using a GEOJSON format
     * @function serializeFeature
     * @param {JSON} feature - a GEOJSON point feature encoding a camera.
     * @return {Camera} - the decoded camera.
     *
     */
    serializeFeature: function serializeFeature(camera, crsName) {
      const disto = camera.distos ? camera.distos[0] : {};
      const elements = camera.imageMatrix.elements;

      // crsName
      // todo  (using crsName?)
      const epsg = '4978';
      const epsgquaternion = '4978'; // same as epsg ?
      const source = '0';

      const feature = {
        type: 'Feature',
        geometry : {
          type: 'Point',
          coordinates : [
            camera.position.x,
            camera.position.y,
            camera.position.z
          ]
        },
        properties : {
          name: camera.name,
          epsgquaternion: epsgquaternion,
          source: source,
          fx: camera.focal.x,
          fy: camera.focal.y,
          sx: camera.view.fullWidth,
          sy: camera.view.fullHeight,
          px: camera.point.x,
          py: camera.point.y,
          cx: disto.C.x,
          cy: disto.C.y,
          c3: disto.R.x,
          c5: disto.R.y,
          c7: disto.R.z,
          cm: disto.R.w,
          m00: elements[ 0],
          m01: elements[ 1],
          m10: elements[ 4],
          m11: elements[ 5],
          m20: elements[12],
          m21: elements[13],
          qx:camera.quaternion.x,
          qy:camera.quaternion.y,
          qz:camera.quaternion.z,
          qw:camera.quaternion.w
        }
      };

      return feature;
    },

    serialize(cameras, crsName) {
      if (cameras.children) cameras = cameras.children;
      const features = cameras.map(cam => this.serializeFeature(cam, crsName));
      const geojson = {
        type: 'FeatureCollection',
        features: features,
        crs: {
          type:'name',
          properties: { name: crsName }
        }
      };
      return JSON.stringify(geojson);
    }
};
