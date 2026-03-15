#!/bin/bash
# Sets the booted iOS Simulator's GPS location to a named preset.
# Usage: ./scripts/set-location.sh <name>

case "$1" in
  warsaw)            xcrun simctl location booted set 52.2297,21.0122 ;;
  delft)             xcrun simctl location booted set 52.0116,4.3571 ;;
  beestenmarkt)      xcrun simctl location booted set 52.0114448,4.3625518 ;;
  markt)             xcrun simctl location booted set 52.0116561,4.3591321 ;;
  newonce)           xcrun simctl location booted set 52.2310530,21.0223376 ;;
  pkin)              xcrun simctl location booted set 52.2319323,21.0069858 ;;
  zamkowy)           xcrun simctl location booted set 52.2473194,21.0135979 ;;
  mokotowskie|pole)  xcrun simctl location booted set 52.2125645,20.9970414 ;;
  poniat)            xcrun simctl location booted set 52.2360465,21.0431803 ;;
  schodki)           xcrun simctl location booted set 52.2368793,21.0356436 ;;
  tulibrary|tu)      xcrun simctl location booted set 52.0025970,4.3753937 ;;
  *)
    echo "Usage: $0 <location>"
    echo ""
    echo "Locations:"
    echo "  warsaw         Warsaw city center"
    echo "  delft          Delft city center"
    echo "  beestenmarkt   Beestenmarkt zone (Delft)"
    echo "  markt          Markt zone (Delft)"
    echo "  tulibrary|tu   TU Library zone (Delft)"
    echo "  newonce        Newonce zone (Warsaw)"
    echo "  pkin           PKiN zone (Warsaw)"
    echo "  zamkowy        Pl. Zamkowy zone (Warsaw)"
    echo "  mokotowskie    Pole Mokotowskie zone (Warsaw)"
    echo "  poniat         Poniat zone (Warsaw)"
    echo "  schodki        Schodki zone (Warsaw)"
    exit 1
    ;;
esac

echo "Location set to $1"
