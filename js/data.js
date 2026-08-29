// 해양사업본부 도장공장 야드 데이터
// 출처: 블라스팅셀/도장셀 규격표 (표 기준 셀 번호/개수 채택) + 사용자 확인 사항(2026-08-26, 2026-08-29):
//   - 도장1공장: 1-1·1-2 = 블라스팅셀(각자 도장셀로 바로 빼내는 빅도어 보유),
//     1-3 = 통합 도장셀(칸막이 없이 뻥 뚫린 구조, 측면 입구 5A/B·7B/A로 블록 입출).
//     블라스팅 완료 블록은 3A/B 빅도어를 통해 블라스팅셀 → 1-3 도장셀로 이동.
//   - 도장2공장: BLASTING SHOP과 PAINT'G SHOP이 각각 독립적으로 1부터 번호가 매겨진다
//     (블라스팅 2-1·2-2, 도장 2-1~2-8). 건물상 실제 물리적 위치 순서(정문 쪽부터)는
//     블라스팅 2-1(#1)·2-2(#2) 다음 도장 2-1(#3)~2-8(#10)로 이어지며, 이 연속 번호를
//     각 셀의 signage 필드에 담아둔다(엑셀 배치도 상 표기 확인, 2026-08-29).
//   - 도장2공장 블라스팅 2-1(#1) 셀은 다른 셀과 달리 건물 내에서 90도(반시계 방향)
//     회전된 형태로 지어져 있어, w/h가 다른 블라스팅셀과 가로/세로가 바뀌어 있다
//     (건축규격 40m×32m). 입고 사이즈(netW/netL 38×31)가 이 방향으로만 자연스럽게
//     들어맞는다.
//   - 각 셀은 벽면 양옆 장비 때문에 실제 블록 배치 가능 폭이 셀 크기보다 줄어듦
//     (EQUIPMENT_CLEARANCE_M 만큼 사방 여유 필요).
// 좌표는 항공사진 배치를 참고한 개략도(schematic)이며 실측 좌표가 아님.

export const STAGE_LABEL = {
  blast: '블라스팅',
  paint: '도장',
};

// 셀 벽면 장비로 인해 사방으로 띄워야 하는 여유 폭(m)
export const EQUIPMENT_CLEARANCE_M = 1.5;

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
          id: 'f1-paint3', name: '1-3 도장셀', factory: '1공장', type: 'paint',
          x: 0, y: 130, w: 228, h: 56, hh: 17,
          capacity: 24, area: 12768,
          note: '칸막이 없는 통합 공간. 측면 입구 5A/B·7B/A로 블록 입출, 블라스팅셀에서는 3A/B 빅도어로 반입.',
        },
        {
          id: 'f1-blast1', name: '1-1 블라스팅셀', factory: '1공장', type: 'blast',
          x: 153, y: 130, w: 75, h: 28, hh: 17,
          netW: 74, netL: 25, // 입고 사이즈(실사용) 25×74
          capacity: 3, area: 2100,
          note: '단독 빅도어로 1-3 도장셀로 직접 반출 가능.',
        },
        {
          id: 'f1-blast2', name: '1-2 블라스팅셀', factory: '1공장', type: 'blast',
          x: 153, y: 158, w: 75, h: 28, hh: 17,
          netW: 74, netL: 25,
          capacity: 3, area: 2100,
          note: '단독 빅도어로 1-3 도장셀로 직접 반출 가능.',
        },
      ],
    },
    {
      id: 'f2',
      name: '도장2공장',
      x: 140, y: 40, w: 336, h: 46,
      cells: [
        { id: 'f2-blast1', name: '2-1 블라스팅셀', signage: 1, factory: '2공장', type: 'blast', x: 140, y: 40, w: 40, h: 32, hh: 15, netW: 38, netL: 31, capacity: 2, area: 1280 },
        { id: 'f2-blast2', name: '2-2 블라스팅셀', signage: 2, factory: '2공장', type: 'blast', x: 180, y: 40, w: 32, h: 40, hh: 15, netW: 38, netL: 31, capacity: 2, area: 1280 },
        { id: 'f2-paint1', name: '2-1 도장셀', signage: 3, factory: '2공장', type: 'paint', x: 212, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint2', name: '2-2 도장셀', signage: 4, factory: '2공장', type: 'paint', x: 244, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint3', name: '2-3 도장셀', signage: 5, factory: '2공장', type: 'paint', x: 276, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint4', name: '2-4 도장셀', signage: 6, factory: '2공장', type: 'paint', x: 308, y: 40, w: 32, h: 40, hh: 14.5, capacity: 2, area: 1280 },
        { id: 'f2-paint5', name: '2-5 도장셀', signage: 7, factory: '2공장', type: 'paint', x: 340, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
        { id: 'f2-paint6', name: '2-6 도장셀', signage: 8, factory: '2공장', type: 'paint', x: 374, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
        { id: 'f2-paint7', name: '2-7 도장셀', signage: 9, factory: '2공장', type: 'paint', x: 408, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
        { id: 'f2-paint8', name: '2-8 도장셀', signage: 10, factory: '2공장', type: 'paint', x: 442, y: 40, w: 34, h: 46, hh: 16, capacity: 2, area: 1564 },
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

// 셀의 실제 블록 배치 가능 크기: (입고/실사용 사이즈가 있으면 그것을, 없으면 건축규격을 기준으로)
// 양옆 장비 여유(EQUIPMENT_CLEARANCE_M)를 사방으로 뺀 값.
export function usablePlacementSize(cell) {
  const baseW = cell.netW ?? cell.w;
  const baseL = cell.netL ?? cell.h;
  return {
    w: Math.max(0, baseW - EQUIPMENT_CLEARANCE_M * 2),
    l: Math.max(0, baseL - EQUIPMENT_CLEARANCE_M * 2),
  };
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
