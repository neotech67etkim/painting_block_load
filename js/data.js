// 해양사업본부 도장공장 야드 데이터
// 출처: 블라스팅셀/도장셀 규격표 (표 기준 셀 번호/개수 채택)
// 좌표는 항공사진 배치를 참고한 개략도(schematic)이며 실측 좌표가 아님.

export const STAGE_LABEL = {
  blast: '블라스팅',
  paint: '도장',
};

export const YARD = {
  name: '해양사업본부 블록도장공장',
  factories: [
    {
      id: 'f1',
      name: '도장1공장',
      // 전체 건물 외곽: 228m(L) x 56m(W), H 17m
      x: 0, y: 130, w: 228, h: 56,
      cells: [
        {
          id: 'f1-paint3', name: '#3 도장셀', factory: '1공장', type: 'paint',
          x: 0, y: 130, w: 228, h: 56, hh: 17,
          capacity: 24, area: 12768,
        },
        {
          id: 'f1-blast1', name: '#1 블라스팅셀', factory: '1공장', type: 'blast',
          x: 153, y: 130, w: 75, h: 28, hh: 17,
          capacity: 3, area: 2100,
        },
        {
          id: 'f1-blast2', name: '#2 블라스팅셀', factory: '1공장', type: 'blast',
          x: 153, y: 158, w: 75, h: 28, hh: 17,
          capacity: 3, area: 2100,
        },
      ],
    },
    {
      id: 'f2',
      name: '도장2공장',
      x: 140, y: 40, w: 328, h: 46,
      cells: [
        { id: 'f2-blast1', name: '#1 블라스팅셀', factory: '2공장', type: 'blast', x: 140, y: 40, w: 32, h: 40, hh: 15, capacity: 2, area: 1280 },
        { id: 'f2-blast2', name: '#2 블라스팅셀', factory: '2공장', type: 'blast', x: 172, y: 40, w: 32, h: 40, hh: 15, capacity: 2, area: 1280 },
        { id: 'f2-paint1', name: '#1 도장셀', factory: '2공장', type: 'paint', x: 204, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint2', name: '#2 도장셀', factory: '2공장', type: 'paint', x: 236, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint3', name: '#3 도장셀', factory: '2공장', type: 'paint', x: 268, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint4', name: '#4 도장셀', factory: '2공장', type: 'paint', x: 300, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint5', name: '#5 도장셀', factory: '2공장', type: 'paint', x: 332, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
        { id: 'f2-paint6', name: '#6 도장셀', factory: '2공장', type: 'paint', x: 366, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
        { id: 'f2-paint7', name: '#7 도장셀', factory: '2공장', type: 'paint', x: 400, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
        { id: 'f2-paint8', name: '#8 도장셀', factory: '2공장', type: 'paint', x: 434, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
      ],
    },
  ],
  // 참고용 랜드마크 (표에 상세 규격 없음 - 시각적 배치 참고용)
  landmarks: [
    { id: 'legacy', name: '조선2야드 선행도장공장\n(참고, 상세 셀 정보 없음)', x: 0, y: 0, w: 102, h: 46, note: '집계: 7,590㎡ / 10개 블록' },
    { id: 'paintstore', name: '도료창', x: 140, y: 0, w: 70, h: 25 },
    { id: 'equipshelter', name: '장비보관쉘터', x: 230, y: 0, w: 90, h: 25 },
    { id: 'materialstore', name: '자재\n창고', x: -40, y: 130, w: 35, h: 56 },
    { id: 'controlroom', name: '관제실', x: -40, y: 192, w: 35, h: 20 },
  ],
};

// 편의를 위한 전체 셀 목록 (factory 참조 포함)
export const ALL_CELLS = YARD.factories.flatMap(f =>
  f.cells.map(c => ({ ...c, factoryId: f.id, factoryName: f.name }))
);

export function getCell(cellId) {
  return ALL_CELLS.find(c => c.id === cellId) || null;
}

export const YARD_BOUNDS = (() => {
  const rects = [
    ...ALL_CELLS,
    ...YARD.landmarks,
  ];
  const minX = Math.min(...rects.map(r => r.x));
  const minY = Math.min(...rects.map(r => r.y));
  const maxX = Math.max(...rects.map(r => r.x + r.w));
  const maxY = Math.max(...rects.map(r => r.y + r.h));
  const margin = 15;
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
})();
