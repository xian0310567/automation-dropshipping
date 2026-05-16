/**
 * @schema 2.10
 * @input kind: enum("brief", "today", "approval", "login", "signup", "onboarding", "orders", "orderDetail", "cs", "csDetail", "claims", "integrations", "products", "history", "mobileToday", "margins") = "today"
 */

const colors = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  muted: "#F1F5F9",
  border: "#E2E8F0",
  text: "#0F172A",
  sub: "#64748B",
  teal: "#0F766E",
  tealSoft: "#CCFBF1",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  amber: "#D97706",
  amberSoft: "#FEF3C7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
};

const nav = [
  ["today", "오늘 처리"],
  ["orders", "주문"],
  ["cs", "CS"],
  ["claims", "취소·반품"],
  ["products", "상품·재고"],
  ["margins", "가격·마진"],
  ["integrations", "공급사·마켓"],
  ["history", "작업 이력"],
  ["onboarding", "온보딩"],
];

const screens = {
  today: {
    active: "today",
    eyebrow: "운영 홈 · 오늘 처리",
    title: "오늘 처리 대시보드",
    desc: "주문, 상품, 가격, CS, 반품 중 오늘 먼저 봐야 할 일을 한 화면에 모읍니다.",
    cta: "전체 동기화",
    cards: [["CS 긴급", "3건 · SLA 1시간 이내", "red"], ["상품 위험", "8개 · 품절 전 조치", "amber"], ["발주·송장", "12건 · 오늘 마감", "teal"]],
    rows: [["CS 답변 대기", "쿠팡 문의 3건", "배송 지연 문의", "SLA 42분 남음", "긴급", "42분", "답변 확인", "red"], ["품절 위험 상품", "가습기 외 7개", "오너클랜 재고 부족", "판매중지 또는 옵션 수정 필요", "확인 필요", "오늘", "상품 보기", "amber"]],
  },
  orders: {
    active: "orders",
    eyebrow: "주문 운영 · 발주·송장",
    title: "주문 목록",
    desc: "쿠팡 주문과 오너클랜 발주 상태를 나란히 보고 지연 건을 먼저 처리합니다.",
    cta: "주문 새로고침",
    cards: [["발주 승인", "7건 · 공급사 확인", "teal"], ["송장 대기", "5건 · 오늘 마감", "amber"], ["취소 위험", "2건 · 고객 요청", "red"]],
    rows: [["#CP-240518-1021", "쿠팡 · 결제완료", "무선 가습기 화이트 · 김서연", "오너클랜 옵션 재확인 필요", "승인 대기", "오늘 15:00", "상세 검토", "amber"], ["#CP-240518-0984", "쿠팡 · 배송준비", "수납 바스켓 4P · 박민재", "공급사 송장 입력 대기", "송장 대기", "오늘", "송장 확인", "blue"]],
  },
  approval: {
    active: "orders",
    eyebrow: "승인 검토 · 오늘 처리",
    title: "승인 상세 패널",
    desc: "주문, 상품, 고객 문의를 한 화면에서 대조하고 운영자가 최종 처리합니다.",
    cta: "주문 목록",
    cards: [["재고", "공급사 재고 2개", "amber"], ["가격", "마진 14.8% 통과", "teal"], ["CS", "발송 예정 답변 필요", "blue"]],
    rows: [["무선 가습기 화이트", "#CP-240518-1021", "화이트 / USB 케이블 포함", "제주 · 문 앞 요청", "승인 대기", "오늘 15:00", "발주 승인", "amber"], ["배송 지연 문의", "SLA 42분 남음", "오늘 출고 예정 안내", "답변 후 발주 승인", "검토 가능", "42분", "답변 확인", "teal"]],
  },
  orderDetail: {
    active: "orders",
    eyebrow: "주문 #CP-240518-1021",
    title: "발주 승인 검토",
    desc: "공급사 발주 전에 취소 위험, 재고, 중복 발주, 개인정보 마스킹 상태를 확인합니다.",
    cta: "목록으로",
    cards: [["상품", "무선 가습기 화이트", "teal"], ["옵션", "쿠팡·공급사 일치", "teal"], ["위험", "재고 2개 남음", "amber"]],
    rows: [["주문 상태", "결제완료", "김서연 · 제주 제주시", "개인정보 마스킹 적용", "승인 대기", "오늘", "발주 승인", "amber"], ["검토 기준", "중복 발주 없음", "공급사 출고 가능", "CS 문의 1건 연결", "통과", "14.8%", "보류", "teal"]],
  },
  cs: {
    active: "cs",
    eyebrow: "고객 응대 · SLA",
    title: "CS 인박스",
    desc: "답변 마감이 가까운 문의와 주문 위험도를 함께 보며 우선순위를 정합니다.",
    cta: "문의 동기화",
    cards: [["SLA 1시간 이내", "3건 · 즉시 확인", "red"], ["배송 문의", "6건 · 송장 확인", "teal"], ["교환·반품", "4건 · 승인 필요", "amber"]],
    rows: [["배송 지연 문의", "이하나 · #CP-240518-1021", "오늘 발송 예정인지 확인 요청", "공급사 출고일 대조 필요", "초안 준비", "42분", "답변 검토", "teal"], ["옵션 변경 요청", "정다은 · #CP-240518-0962", "색상 변경 가능 여부", "발주 전 상태라 수정 가능", "확인 필요", "2시간", "주문 확인", "amber"]],
  },
  csDetail: {
    active: "cs",
    eyebrow: "CS 상세 · 답변 승인",
    title: "답변 초안 승인",
    desc: "주문 상황과 공급사 출고 정보를 확인한 뒤 고객에게 보낼 답변을 확정합니다.",
    cta: "CS 인박스",
    cards: [["주문 상태", "결제완료 · 발주 대기", "amber"], ["공급사 확인", "오늘 16시 이전 출고", "teal"], ["권장 처리", "답변 후 발주 승인", "blue"]],
    rows: [["고객 문의", "배송이 언제 시작되나요?", "선물용이라 오늘 출고 가능 여부 확인", "#CP-240518-1021", "긴급", "42분", "답변 발송", "red"], ["답변 초안", "오늘 출고 예정 안내", "송장 등록 즉시 쿠팡에서 확인 가능", "정책 문구 확인", "검토 가능", "즉시", "수정 요청", "teal"]],
  },
  claims: {
    active: "claims",
    eyebrow: "취소·반품 · 위험 처리",
    title: "취소·반품",
    desc: "고객 요청, 공급사 가능 여부, 쿠팡 처리 기한을 한 화면에서 확인합니다.",
    cta: "요청 새로고침",
    cards: [["취소 승인", "2건 · 발주 전", "teal"], ["반품 회수", "5건 · 택배 예약", "amber"], ["분쟁 위험", "1건 · 오늘 답변", "red"]],
    rows: [["취소 요청", "#CP-240518-0877", "발주 전 취소 가능 · 단순 변심", "발주 큐에서 제외 필요", "승인 가능", "오늘 14:30", "승인 검토", "teal"], ["반품 회수", "#CP-240517-0641", "상품 파손 접수 · 사진 첨부", "공급사 반품 주소 확인", "확인 필요", "내일", "회수 설정", "amber"]],
  },
  integrations: {
    active: "integrations",
    eyebrow: "공급사·마켓 · 쿠팡",
    title: "마켓 연동",
    desc: "판매자가 서비스 안에서 쿠팡을 직접 연결하고, 주문 수집과 운영 처리에 필요한 자격증명을 안전하게 보관합니다.",
    cta: "쿠팡 연결 저장",
    cards: [["연동 상태", "연결됨 · A00****56", "teal"], ["자격증명", "서명 준비 완료", "teal"], ["동기화 작업", "3개 작업 대기 중", "amber"]],
    rows: [["쿠팡 WING Open API", "본점 쿠팡", "키는 저장 후 다시 표시하지 않음", "연결 변경은 소유자·관리자만 가능", "연결됨", "오늘", "키 확인", "teal"], ["동기화 작업", "주문 수집 · 상품 확인 · 문의 확인", "3개 작업이 대기 중입니다.", "처리 결과는 작업 이력에서 확인", "대기 중", "지금", "상태 보기", "amber"]],
  },
  products: {
    active: "products",
    eyebrow: "운영 관리 · 상품",
    title: "상품·재고 모니터링",
    desc: "판매중 상품의 품절 위험, 옵션 매핑, 공급가 변동을 한 화면에서 확인하고 필요한 판매 조치를 고릅니다.",
    cta: "상품 동기화",
    cards: [["품절 위험", "8개 · 판매중", "teal"], ["매핑 누락", "4개 · 확인 필요", "neutral"], ["판매중지 검토", "3개 · 즉시 확인", "red"]],
    rows: [["무선 미니 가습기", "OC-8831 · 화이트", "오너클랜 재고 2개 남음", "쿠팡 판매 18개", "품절 임박", "상", "판매 조치", "amber"], ["방수 욕실 매트", "OC-1274 · 그레이", "옵션 매핑 누락", "주문 3건 확인 필요", "확인 필요", "중", "매핑 확인", "red"]],
  },
  history: {
    active: "history",
    eyebrow: "운영 기록 · 알림",
    title: "작업 이력·알림",
    desc: "누가 어떤 주문과 상품을 처리했는지, 어떤 알림이 발송됐는지 추적합니다.",
    cta: "이력 내보내기",
    cards: [["오늘 처리", "28건 · 정상 완료", "teal"], ["승인 보류", "3건 · 사유 확인", "amber"], ["실패 알림", "1건 · 재확인", "red"]],
    rows: [["CS 답변 승인", "운영자 김하린", "배송 지연 문의 답변 발송", "#CP-240518-1021 · 고객 알림 완료", "완료", "09:42", "상세 보기", "teal"], ["상품 판매중지", "운영자 이준", "무선 가습기 화이트 품절 위험 처리", "재고 회복 시 재노출 예정", "완료", "09:18", "상품 보기", "teal"]],
  },
  margins: {
    active: "margins",
    eyebrow: "가격 운영 · 마진",
    title: "가격·마진 모니터링",
    desc: "공급가 변동과 쿠팡 판매가를 비교해 손실 위험 상품을 먼저 확인합니다.",
    cta: "가격 새로고침",
    cards: [["손실 위험", "3개 · 즉시 확인", "red"], ["마진 하락", "9개 · 가격 검토", "amber"], ["정상", "1,198개", "teal"]],
    rows: [["캠핑 접이식 의자", "OC-33192 · 쿠팡 판매중", "공급가 18,400원 → 21,900원", "현재 판매가 유지 시 예상 마진 -3.2%", "손실 위험", "-3.2%", "가격 조정", "red"], ["실리콘 조리도구 세트", "OC-44901 · 광고 노출중", "경쟁가 하락으로 전환율 저하", "최소 마진 12% 이상 유지 가능", "검토", "12.4%", "가격 확인", "amber"]],
  },
  onboarding: {
    active: "onboarding",
    eyebrow: "Demo Seller · 최초 설정",
    title: "연동 준비",
    desc: "실제 판매 운영 전에 워크스페이스, 쿠팡, 오너클랜, 알림, 첫 동기화를 준비합니다.",
    cta: "설정 저장",
    cards: [["워크스페이스", "판매자 기본 정보 완료", "teal"], ["쿠팡 연동", "주문 수집 확인", "amber"], ["알림 기준", "위험 알림 기본값", "blue"]],
    rows: [["쿠팡 연동", "판매자 ID A00123456", "연동 키는 안전하게 보관", "주문 수집 가능 여부 확인", "확인 필요", "오늘", "주문 수집 확인", "amber"], ["오너클랜 준비", "연동 또는 파일 발주", "계정 계약 방식 확인", "송장 처리 범위 설정", "계약 확인", "다음", "설정 보기", "teal"]],
  },
};

function tone(key) {
  if (key === "red") return [colors.red, colors.redSoft];
  if (key === "amber") return [colors.amber, colors.amberSoft];
  if (key === "blue") return [colors.blue, colors.blueSoft];
  return [colors.teal, colors.tealSoft];
}

function t(x, y, width, content, size, weight, fill, lineHeight = 1.35) {
  return {
    type: "text",
    x,
    y,
    width,
    textGrowth: "fixed-width",
    content,
    fill,
    fontFamily: "Inter",
    fontSize: size,
    fontWeight: weight,
    lineHeight,
  };
}

function box(x, y, width, height, fill, stroke = colors.border, radius = 8) {
  return {
    type: "frame",
    x,
    y,
    width,
    height,
    cornerRadius: radius,
    fill,
    stroke: stroke ? { fill: stroke, thickness: 1 } : undefined,
    layout: "none",
  };
}

function pill(x, y, label, key) {
  const [fg, bg] = tone(key);
  return [
    box(x, y, 76, 24, bg, null, 999),
    t(x + 10, y + 4, 56, label, 12, "700", fg),
  ];
}

function sidebar(active) {
  const nodes = [
    box(0, 0, 244, pencil.height, colors.surface, colors.border, 0),
    box(18, 22, 34, 34, colors.tealSoft, "#99F6E4", 8),
    t(27, 33, 20, "CO", 11, "800", colors.teal),
    t(62, 23, 150, "운영 모니터링", 14, "700", colors.text),
    t(62, 43, 150, "Demo Seller", 12, "400", colors.sub),
  ];
  nav.forEach(([key, label], index) => {
    const y = 82 + index * 36;
    const selected = active === key;
    nodes.push(box(12, y, 220, 34, selected ? "#E2E8F0" : colors.surface, null, 8));
    nodes.push(t(24, y + 8, 180, label, 13, selected ? "700" : "600", selected ? colors.text : "#475569"));
  });
  nodes.push(t(12, pencil.height - 94, 80, "권한", 12, "400", colors.sub));
  nodes.push(t(180, pencil.height - 94, 48, "소유자", 12, "700", colors.text));
  nodes.push(t(12, pencil.height - 68, 90, "최근 동기화", 12, "400", colors.sub));
  nodes.push(t(180, pencil.height - 68, 48, "3분 전", 12, "700", colors.text));
  nodes.push(box(12, pencil.height - 46, 220, 32, colors.surface, colors.border, 8));
  nodes.push(t(101, pencil.height - 38, 60, "동기화", 12, "700", colors.text));
  return nodes;
}

function desktop(data) {
  const nodes = [box(0, 0, pencil.width, pencil.height, colors.bg, null, 0), ...sidebar(data.active)];
  const x0 = 244;
  nodes.push(box(x0, 0, pencil.width - x0, 56, colors.bg, colors.border, 0));
  nodes.push(t(x0 + 20, 10, 240, "쿠팡·오너클랜 위탁판매", 12, "400", colors.sub));
  nodes.push(t(x0 + 20, 29, 360, "오늘 처리할 작업을 우선순위대로 확인하세요.", 13, "700", colors.text));
  nodes.push(box(pencil.width - 158, 13, 66, 30, colors.tealSoft, "#99F6E4", 8));
  nodes.push(t(pencil.width - 146, 21, 48, "정상 수집", 12, "700", colors.teal));
  nodes.push(box(pencil.width - 84, 13, 64, 30, colors.surface, colors.border, 8));
  nodes.push(t(pencil.width - 72, 21, 42, "로그아웃", 12, "700", colors.text));
  nodes.push(t(x0 + 20, 78, 220, data.eyebrow, 12, "700", data.active === "claims" ? colors.red : colors.teal));
  nodes.push(t(x0 + 20, 98, 360, data.title, 23, "800", colors.text));
  nodes.push(t(x0 + 20, 132, 720, data.desc, 13, "400", colors.sub, 1.55));
  nodes.push(box(pencil.width - 126, 74, 106, 34, colors.teal, null, 8));
  nodes.push(t(pencil.width - 112, 83, 82, data.cta, 13, "700", "#FFFFFF"));
  const cardY = 166;
  const cardW = (pencil.width - x0 - 60) / 3;
  data.cards.forEach((card, i) => {
    const [, bg] = tone(card[2]);
    const x = x0 + 20 + i * (cardW + 10);
    nodes.push(box(x, cardY, cardW, 70, i === 0 ? bg : colors.surface, i === 0 ? "#99F6E4" : colors.border, 8));
    nodes.push(t(x + 14, cardY + 13, cardW - 28, card[0], 12, "700", colors.sub));
    nodes.push(t(x + 14, cardY + 36, cardW - 28, card[1], 16, "800", colors.text));
  });
  const tableX = x0 + 20;
  const tableY = 250;
  const tableW = pencil.width - x0 - 40;
  nodes.push(box(tableX, tableY, tableW, 218, colors.surface, colors.border, 8));
  nodes.push(box(tableX + 12, tableY + 10, tableW - 96, 34, colors.surface, colors.border, 8));
  nodes.push(t(tableX + 24, tableY + 19, 360, "주문번호, 상품명, 고객 문의, 위험 유형 검색", 12, "400", "#94A3B8"));
  nodes.push(box(tableX + tableW - 74, tableY + 10, 62, 34, colors.surface, colors.border, 8));
  nodes.push(t(tableX + tableW - 55, tableY + 19, 28, "오늘", 12, "700", colors.text));
  nodes.push(box(tableX, tableY + 54, tableW, 40, colors.muted, null, 0));
  ["업무", "상세", "상태", "마감", "처리"].forEach((label, i) => {
    const widths = [330, 500, 110, 100, 110];
    const offsets = [16, 346, 846, 956, 1056];
    nodes.push(t(tableX + offsets[i], tableY + 68, widths[i], label, 12, "700", "#475569"));
  });
  data.rows.forEach((row, i) => {
    const y = tableY + 94 + i * 66;
    nodes.push(box(tableX, y, tableW, 1, colors.border, null, 0));
    nodes.push(t(tableX + 16, y + 16, 300, row[0], 13, "700", colors.text));
    nodes.push(t(tableX + 16, y + 36, 300, row[1], 12, "400", colors.sub));
    nodes.push(t(tableX + 346, y + 16, 470, row[2], 13, "700", colors.text));
    nodes.push(t(tableX + 346, y + 36, 470, row[3], 12, "400", colors.sub));
    nodes.push(...pill(tableX + 846, y + 17, row[4], row[7]));
    nodes.push(t(tableX + 956, y + 22, 80, row[5], 13, "700", row[7] === "red" ? colors.red : colors.text));
    nodes.push(box(tableX + 1056, y + 16, 88, 32, row[7] === "red" ? colors.red : colors.teal, null, 8));
    nodes.push(t(tableX + 1068, y + 24, 64, row[6], 12, "700", "#FFFFFF"));
  });
  return nodes;
}

function mobileToday(data) {
  const nodes = [box(0, 0, pencil.width, pencil.height, colors.bg, null, 0)];
  nodes.push(box(0, 0, pencil.width, 54, colors.surface, colors.border, 0));
  ["오늘 처리", "주문", "CS", "상품"].forEach((label, i) => {
    const widths = [72, 46, 40, 46];
    const x = 10 + [0, 78, 130, 176][i];
    nodes.push(box(x, 10, widths[i], 34, i === 0 ? "#E2E8F0" : colors.surface, null, 8));
    nodes.push(t(x + 10, 18, widths[i] - 20, label, 13, i === 0 ? "700" : "600", i === 0 ? colors.text : "#475569"));
  });
  nodes.push(t(14, 74, 180, "Demo Seller · 오늘 처리", 12, "700", colors.teal));
  nodes.push(t(14, 96, 260, "오늘 처리", 22, "800", colors.text));
  nodes.push(box(298, 82, 104, 34, colors.teal, null, 8));
  nodes.push(t(317, 91, 70, "새로고침", 13, "700", "#FFFFFF"));
  data.cards.forEach((card, i) => {
    const [, bg] = tone(card[2]);
    const y = 142 + i * 82;
    nodes.push(box(14, y, pencil.width - 28, 70, i === 0 ? bg : colors.surface, i === 0 ? "#99F6E4" : colors.border, 8));
    nodes.push(t(28, y + 13, 180, card[0], 12, "700", colors.sub));
    nodes.push(t(28, y + 36, 260, card[1], 16, "800", colors.text));
  });
  data.rows.forEach((row, i) => {
    const y = 400 + i * 134;
    nodes.push(box(14, y, pencil.width - 28, 120, colors.surface, colors.border, 8));
    nodes.push(t(28, y + 18, 280, row[0], 14, "800", colors.text));
    nodes.push(t(28, y + 41, 280, row[1], 12, "400", colors.sub));
    nodes.push(t(28, y + 66, 260, row[2], 13, "700", colors.text));
    nodes.push(...pill(28, y + 88, row[4], row[7]));
    nodes.push(box(pencil.width - 110, y + 76, 82, 32, row[7] === "red" ? colors.red : colors.teal, null, 8));
    nodes.push(t(pencil.width - 98, y + 84, 58, row[6], 12, "700", "#FFFFFF"));
  });
  return nodes;
}

function publicScreen(kind) {
  const isSignup = kind === "signup";
  const nodes = [box(0, 0, pencil.width, pencil.height, colors.bg, null, 0)];

  if (isSignup) {
    nodes.push(box(198, 182, 500, 680, colors.surface, colors.border, 8));
    nodes.push(t(230, 236, 430, "워크스페이스 시작", 24, "800", colors.text, 1.2));
    nodes.push(t(230, 286, 430, "대표 운영자가 판매자 워크스페이스를 만들고, 비밀번호로 보호되는 계정을 만든 뒤 팀원을 초대합니다.", 14, "400", colors.sub, 1.6));

    [
      ["이메일", "owner@example.com"],
      ["이름", "대표 운영자"],
      ["워크스페이스 이름", "Demo Seller"],
      ["비밀번호", "영문과 숫자 포함 10자 이상"],
    ].forEach((field, i) => {
      const y = 370 + i * 92;
      nodes.push(t(230, y, 420, field[0], 13, "700", colors.text));
      nodes.push(box(230, y + 28, 436, 46, colors.surface, colors.border, 6));
      nodes.push(t(244, y + 42, 360, field[1], 14, "400", colors.sub));
    });

    nodes.push(box(230, 774, 436, 48, colors.teal, null, 6));
    nodes.push(t(412, 789, 90, "온보딩 시작", 14, "700", "#FFFFFF"));
    nodes.push(box(718, 182, 520, 660, colors.muted, colors.border, 8));
    nodes.push(t(750, 232, 360, "가입 후 바로 필요한 세 가지", 22, "800", colors.text));
    [["1. 판매자 프로필", "쿠팡 벤더 ID와 운영 지역, 담당자 연락 채널을 먼저 고정합니다."], ["2. 연동 준비", "쿠팡 주문 수집, 오너클랜 발주 방식, CSV 처리 범위를 확인합니다."], ["3. 알림·확인 기준", "발주, 송장, CS 답변, 반품은 확인 흐름으로 시작합니다."]].forEach((step, i) => {
      const y = 312 + i * 142;
      nodes.push(box(750, y, 456, 118, colors.surface, colors.border, 8));
      nodes.push(t(772, y + 24, 280, step[0], 17, "800", colors.text));
      nodes.push(t(772, y + 58, 390, step[1], 14, "400", colors.sub, 1.5));
    });
    return nodes;
  }

  nodes.push(box(198, 202, 560, 520, colors.muted, colors.border, 8));
  nodes.push(t(230, 236, 170, "Coupang Ownerclan Ops", 14, "700", colors.teal));
  nodes.push(t(230, 270, 490, "주문과 CS를 안전하게 처리하는 운영 워크스페이스", 28, "800", colors.text, 1.2));
  nodes.push(t(230, 350, 490, "쿠팡 주문, 오너클랜 발주, 송장, 취소·반품 위험, CS 답변 초안을 한 화면에서 확인합니다.", 14, "400", colors.sub, 1.6));
  nodes.push(box(782, 287, 460, 384, colors.surface, colors.border, 8));
  nodes.push(t(814, 319, 360, "운영 워크스페이스에 로그인", 22, "800", colors.text));
  nodes.push(t(814, 360, 360, "작업자 계정과 비밀번호를 확인한 뒤 보호된 대시보드로 이동합니다.", 14, "400", colors.sub, 1.55));
  [["이메일", "operator@example.com"], ["비밀번호", "••••••••••"]].forEach((field, i) => {
    const y = 430 + i * 78;
    nodes.push(t(814, y, 360, field[0], 13, "700", colors.text));
    nodes.push(box(814, y + 28, 396, 44, colors.surface, colors.border, 8));
    nodes.push(t(828, y + 41, 320, field[1], 14, "400", colors.sub));
  });
  nodes.push(box(814, 612, 396, 38, colors.teal, null, 8));
  nodes.push(t(948, 622, 90, "대시보드로 이동", 14, "700", "#FFFFFF"));
  return nodes;
}

function brief() {
  const nodes = [box(0, 0, pencil.width, pencil.height, colors.bg, null, 0)];
  nodes.push(t(64, 54, 240, "위탁판매 모니터링 디자인 원칙", 14, "800", colors.teal));
  nodes.push(t(64, 88, 1050, "shadcn 기준의 고정 LNB와 조밀한 운영 UI로 정리합니다", 30, "800", colors.text, 1.2));
  nodes.push(t(64, 142, 1080, "페이지마다 바뀌던 사이드바는 앱 공통 LNB로 고정하고, 화면별 우선순위는 카드와 테이블 안에서 보여줍니다.", 15, "400", colors.sub, 1.55));
  [["고정 LNB", "오늘 처리, 주문, CS, 상품·재고 등 모든 `/app` 화면에서 같은 메뉴 구조를 유지합니다."], ["작은 UI", "23px 제목, 13px 본문, 34px 버튼, 66px 테이블 행으로 반복 업무에 맞는 밀도를 확보합니다."], ["업무 언어", "내부 단계가 아니라 품절 임박, 송장 대기, 마진 하락처럼 운영자가 바로 행동할 수 있는 말로 씁니다."], ["구현 기준", "pen 디자인을 먼저 수정하고, 이후 Next.js 화면과 Playwright 검증을 이 기준에 맞춥니다."]].forEach((item, i) => {
    const x = 64 + (i % 2) * 656;
    const y = 240 + Math.floor(i / 2) * 180;
    nodes.push(box(x, y, 620, 142, colors.surface, colors.border, 8));
    nodes.push(t(x + 24, y + 24, 240, item[0], 18, "800", colors.text));
    nodes.push(t(x + 24, y + 62, 540, item[1], 14, "400", colors.sub, 1.55));
  });
  return nodes;
}

const kind = pencil.input.kind;
if (kind === "brief") return brief();
if (kind === "login" || kind === "signup") return publicScreen(kind);
if (kind === "mobileToday") return mobileToday(screens.today);
const data = screens[kind] || screens.today;
return desktop(data);
