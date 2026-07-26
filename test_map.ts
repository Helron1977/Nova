const parseContent = (rawContent: string) => {
  const content = rawContent.trim();
  const points = content.split('->').map(p => p.trim());
  const parsedPoints: [number, number][] = [];
  const parsedPopups: string[] = [];
  for (const point of points) {
    const match = point.match(/([0-9.-]+)\s*,\s*([0-9.-]+)(?:\s*\((.*?)\))?/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        parsedPoints.push([lat, lng]);
        parsedPopups.push(match[3] || '');
      }
    }
  }
  const isRoute = parsedPoints.length > 1;
  const markers = parsedPoints.map((pos, idx) => ({
    id: `marker-${idx}`,
    position: pos,
    popupText: parsedPopups[idx] || (isRoute ? `Étape ${idx + 1}` : 'Cible')
  }));
  return {
    center: parsedPoints[0],
    zoom: isRoute ? 6 : 13,
    markers,
    route: isRoute ? parsedPoints : undefined
  };
};

const serializeContent = (data: any) => {
  const serializeMarker = (m: any, idx: number) => {
     const isDefaultText = m.popupText === 'Cible' || m.popupText === `Étape ${idx + 1}`;
     return isDefaultText ? `${m.position[0]}, ${m.position[1]}` : `${m.position[0]}, ${m.position[1]} (${m.popupText})`;
  };

  if (data.route && data.route.length > 1) {
    return data.markers.map((m: any, i: number) => serializeMarker(m, i)).join(' -> ');
  } else if (data.markers && data.markers.length > 0) {
    return data.markers.map((m: any, i: number) => serializeMarker(m, i)).join('\n');
  }
  return `${data.center[0]}, ${data.center[1]}`;
};

const data1 = parseContent("48.85, 2.35");
console.log("data1:", JSON.stringify(data1, null, 2));

const newData = {
  ...data1,
  markers: [
    ...data1.markers,
    { id: 'marker-1', position: [48.9, 2.4], popupText: 'Étape 2' }
  ],
  route: [
    [48.85, 2.35],
    [48.9, 2.4]
  ]
};

const serialized = serializeContent(newData);
console.log("serialized:", serialized);

const parsedBack = parseContent(serialized);
console.log("parsedBack:", JSON.stringify(parsedBack, null, 2));
