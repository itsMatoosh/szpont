import Mapbox from '@rnmapbox/maps';

const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!;

/** Initialise Mapbox with the project access token. Import this module for the side-effect. */
Mapbox.setAccessToken(accessToken);

export default Mapbox;
