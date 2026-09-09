import React, { useEffect, useRef, useState } from 'react';
import { RiskCell } from '../../../../shared/types';

declare global {
  interface Window {
    L: any;
  }
}

export interface CitizenInteractiveMapProps {
  cells: RiskCell[];
  selectedCell: RiskCell | null;
  onSelectCell: (cell: RiskCell) => void;
}

export const CitizenInteractiveMap: React.FC<CitizenInteractiveMapProps> = ({
  cells,
  selectedCell,
  onSelectCell,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLightMode, setIsLightMode] = useState(true);

  // OpenStreetMap - 100% Free, No API Key Required, Zero Watermarks
  const lightTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const darkTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const L = window.L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [17.4150, 78.4600],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      const tileLayer = L.tileLayer(isLightMode ? lightTiles : darkTiles, {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
      setMapLoaded(true);
    }
  }, []);

  const toggleMapTheme = () => {
    const L = window.L;
    if (!L || !mapInstanceRef.current || !tileLayerRef.current) return;

    const newLightState = !isLightMode;
    setIsLightMode(newLightState);

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newTileLayer = L.tileLayer(newLightState ? lightTiles : darkTiles, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  };

  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    cells.forEach((cell) => {
      const isSelected = selectedCell?.hexId === cell.hexId;
      const isHigh = cell.severity === 'HIGH';
      const isMod = cell.severity === 'MODERATE';

      const colorHex = isHigh ? '#ff3131' : isMod ? '#f6a825' : '#0db5ed';

      const circle = L.circle([cell.coords.lat, cell.coords.lng], {
        radius: isHigh ? 1200 : isMod ? 900 : 700,
        color: colorHex,
        weight: isSelected ? 3 : 2,
        fillColor: colorHex,
        fillOpacity: isSelected ? 0.45 : 0.25,
      }).addTo(map);

      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transition-all transform hover:scale-110">
          <span class="absolute w-8 h-8 rounded-full animate-ping opacity-60" style="background-color: ${colorHex}"></span>
          <div className="relative flex items-center gap-1.5 bg-[#ffffff] border-2 text-[#000000] text-[11px] font-mono px-2.5 py-1 rounded-full shadow-xl font-bold" style="border-color: ${colorHex}; box-shadow: 0 4px 12px rgba(0,0,0,0.25)">
            <span className="w-2.5 h-2.5 rounded-full" style="background-color: ${colorHex}"></span>
            <span className="font-bold text-[#000000]">${cell.locality.split(' ')[0]}</span>
            <span className="font-black ml-0.5 text-[#000000]">${cell.waterLevelCm}cm</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-marker',
        iconSize: [130, 38],
        iconAnchor: [65, 19],
      });

      const marker = L.marker([cell.coords.lat, cell.coords.lng], { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        onSelectCell(cell);
        map.panTo([cell.coords.lat, cell.coords.lng], { animate: true });
      });

      circle.on('click', () => {
        onSelectCell(cell);
        map.panTo([cell.coords.lat, cell.coords.lng], { animate: true });
      });

      markersRef.current.push(circle, marker);
    });
  }, [cells, selectedCell, mapLoaded, isLightMode, onSelectCell]);

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-[#ededed] bg-[#f8f9fa] shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#38c6ec] to-transparent shadow-[0_0_15px_#38c6ec] animate-scan pointer-events-none z-10" />
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1 rounded-lg border border-black/10 text-[11px] font-mono text-black font-bold shadow">
        <span>☀️ OPENSTREETMAP LIGHT</span>
        <button onClick={toggleMapTheme} className="text-[10px] bg-black text-white px-2 py-0.5 rounded">
          {isLightMode ? '🗺️ Topo' : '☀️ OSM'}
        </button>
      </div>
    </div>
  );
};

export default CitizenInteractiveMap;
