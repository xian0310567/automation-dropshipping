export type Tone = "teal" | "red" | "amber" | "blue" | "neutral";

export type WorkRow = {
  work: string;
  workMeta: string;
  detail: string;
  detailMeta: string;
  status: string;
  statusTone: Tone;
  due: string;
  dueTone?: Tone;
  action: string;
  actionTone: Tone;
  href?: string;
};

export type SideItem = {
  label: string;
  meta: string;
  tone: Tone;
  active?: boolean;
  href?: string;
};

export type MonitoringScreen = {
  referenceId: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  sidebarTitle: string;
  sidebarDescription: string;
  sideItems: SideItem[];
  searchPlaceholder: string;
  filterLabel: string;
  columns: [string, string, string, string, string];
  rows: WorkRow[];
};

export const monitoringScreens = {
  today: {
    referenceId: "DkLfQ",
    eyebrow: "운영 홈 · 오늘 처리",
    title: "오늘 처리 대시보드",
    description: "주문, 상품, 가격, CS, 반품 중 오늘 먼저 봐야 할 일을 한 화면에 모읍니다.",
    cta: "전체 동기화",
    sidebarTitle: "오늘 처리",
    sidebarDescription: "마감이 가까운 업무부터 정렬했습니다.",
    sideItems: [
      { label: "CS 긴급", meta: "3건 · SLA 1시간 이내", tone: "red", active: true, href: "/app/cs" },
      { label: "상품 위험", meta: "8개 · 품절 전 조치", tone: "amber", href: "/app/products" },
      { label: "발주·송장", meta: "12건 · 오늘 마감", tone: "teal", href: "/app/orders" },
    ],
    searchPlaceholder: "주문번호, 상품명, 고객 문의, 위험 유형 검색",
    filterLabel: "오늘",
    columns: ["업무", "상세", "상태", "마감", "처리"],
    rows: [
      {
        work: "CS 답변 대기",
        workMeta: "쿠팡 문의 3건",
        detail: "배송 지연 문의",
        detailMeta: "SLA 42분 남음",
        status: "긴급",
        statusTone: "red",
        due: "42분",
        dueTone: "red",
        action: "답변 확인",
        actionTone: "teal",
        href: "/app/cs/detail",
      },
      {
        work: "품절 위험 상품",
        workMeta: "가습기 외 7개",
        detail: "오너클랜 재고 부족",
        detailMeta: "판매중지 또는 옵션 수정 필요",
        status: "확인 필요",
        statusTone: "amber",
        due: "오늘",
        dueTone: "red",
        action: "상품 보기",
        actionTone: "red",
        href: "/app/products",
      },
    ],
  },
  orders: {
    referenceId: "dhrCg",
    eyebrow: "주문 운영 · 발주·송장",
    title: "주문 목록",
    description: "쿠팡 주문과 오너클랜 발주 상태를 나란히 보고 지연 건을 먼저 처리합니다.",
    cta: "주문 새로고침",
    sidebarTitle: "주문 큐",
    sidebarDescription: "발주 승인과 송장 입력이 필요한 주문입니다.",
    sideItems: [
      { label: "발주 승인", meta: "7건 · 공급사 확인", tone: "teal", active: true, href: "/app/orders/review" },
      { label: "송장 대기", meta: "5건 · 오늘 마감", tone: "amber" },
      { label: "취소 위험", meta: "2건 · 고객 요청", tone: "red", href: "/app/claims" },
    ],
    searchPlaceholder: "주문번호, 수취인, 상품명 검색",
    filterLabel: "발주 필요",
    columns: ["주문", "상품·수취인", "상태", "마감", "처리"],
    rows: [
      {
        work: "#CP-240518-1021",
        workMeta: "쿠팡 · 결제완료",
        detail: "무선 가습기 화이트 · 김서연",
        detailMeta: "오너클랜 옵션 재확인 필요",
        status: "승인 대기",
        statusTone: "amber",
        due: "오늘 15:00",
        dueTone: "red",
        action: "상세 검토",
        actionTone: "teal",
        href: "/app/orders/review",
      },
      {
        work: "#CP-240518-0984",
        workMeta: "쿠팡 · 배송준비",
        detail: "수납 바스켓 4P · 박민재",
        detailMeta: "공급사 송장 입력 대기",
        status: "송장 대기",
        statusTone: "blue",
        due: "오늘",
        dueTone: "amber",
        action: "송장 확인",
        actionTone: "neutral",
      },
    ],
  },
  cs: {
    referenceId: "u347IV",
    eyebrow: "고객 응대 · SLA",
    title: "CS 인박스",
    description: "답변 마감이 가까운 문의와 주문 위험도를 함께 보며 우선순위를 정합니다.",
    cta: "문의 동기화",
    sidebarTitle: "응대 우선순위",
    sidebarDescription: "고객 영향과 남은 시간을 기준으로 묶었습니다.",
    sideItems: [
      { label: "SLA 1시간 이내", meta: "3건 · 즉시 확인", tone: "red", active: true, href: "/app/cs/detail" },
      { label: "배송 문의", meta: "6건 · 송장 확인", tone: "teal" },
      { label: "교환·반품", meta: "4건 · 승인 필요", tone: "amber", href: "/app/claims" },
    ],
    searchPlaceholder: "고객명, 주문번호, 문의 내용 검색",
    filterLabel: "긴급 문의",
    columns: ["문의", "내용", "상태", "SLA", "처리"],
    rows: [
      {
        work: "배송 지연 문의",
        workMeta: "이하나 · #CP-240518-1021",
        detail: "오늘 발송 예정인지 확인 요청",
        detailMeta: "주문 상세와 공급사 출고일 대조 필요",
        status: "초안 준비",
        statusTone: "teal",
        due: "42분",
        dueTone: "red",
        action: "답변 검토",
        actionTone: "teal",
        href: "/app/cs/detail",
      },
      {
        work: "옵션 변경 요청",
        workMeta: "정다은 · #CP-240518-0962",
        detail: "색상 변경 가능 여부 문의",
        detailMeta: "발주 전 상태라 수정 가능",
        status: "확인 필요",
        statusTone: "amber",
        due: "2시간",
        dueTone: "amber",
        action: "주문 확인",
        actionTone: "neutral",
        href: "/app/orders/review",
      },
    ],
  },
  claims: {
    referenceId: "vf3YB",
    eyebrow: "취소·반품 · 위험 처리",
    title: "취소·반품",
    description: "고객 요청, 공급사 가능 여부, 쿠팡 처리 기한을 한 화면에서 확인합니다.",
    cta: "요청 새로고침",
    sidebarTitle: "처리 구분",
    sidebarDescription: "비용과 고객 영향이 큰 건부터 보여줍니다.",
    sideItems: [
      { label: "취소 승인", meta: "2건 · 발주 전", tone: "teal", active: true },
      { label: "반품 회수", meta: "5건 · 택배 예약", tone: "amber" },
      { label: "분쟁 위험", meta: "1건 · 오늘 답변", tone: "red" },
    ],
    searchPlaceholder: "주문번호, 요청 유형, 고객명 검색",
    filterLabel: "처리 필요",
    columns: ["요청", "상세", "상태", "기한", "처리"],
    rows: [
      {
        work: "취소 요청",
        workMeta: "#CP-240518-0877",
        detail: "발주 전 취소 가능 · 고객 단순 변심",
        detailMeta: "쿠팡 취소 승인 후 발주 큐에서 제외",
        status: "승인 가능",
        statusTone: "teal",
        due: "오늘 14:30",
        dueTone: "red",
        action: "승인 검토",
        actionTone: "teal",
      },
      {
        work: "반품 회수",
        workMeta: "#CP-240517-0641",
        detail: "상품 파손 접수 · 사진 첨부됨",
        detailMeta: "공급사 반품 주소 확인 필요",
        status: "확인 필요",
        statusTone: "amber",
        due: "내일",
        action: "회수 설정",
        actionTone: "neutral",
      },
    ],
  },
  suppliers: {
    referenceId: "jnl9R",
    eyebrow: "연동 상태 · 공급사·마켓",
    title: "공급사·마켓 상태",
    description: "오너클랜, 쿠팡, 알림 채널의 연결 상태와 최근 동기화 결과를 확인합니다.",
    cta: "연동 확인",
    sidebarTitle: "채널 상태",
    sidebarDescription: "운영에 영향이 있는 연결만 요약합니다.",
    sideItems: [
      { label: "쿠팡 마켓", meta: "정상 · 3분 전", tone: "teal", active: true },
      { label: "오너클랜", meta: "주의 · 일부 지연", tone: "amber" },
      { label: "알림 채널", meta: "정상 · 즉시 발송", tone: "teal" },
    ],
    searchPlaceholder: "채널명, 오류 메시지, 동기화 항목 검색",
    filterLabel: "주의 상태",
    columns: ["채널", "최근 결과", "상태", "시각", "처리"],
    rows: [
      {
        work: "오너클랜 재고",
        workMeta: "상품 1,284개",
        detail: "8개 상품 재고 부족 응답",
        detailMeta: "품절 위험 화면에 반영됨",
        status: "주의",
        statusTone: "amber",
        due: "5분 전",
        action: "상품 보기",
        actionTone: "teal",
        href: "/app/products",
      },
      {
        work: "쿠팡 주문",
        workMeta: "신규 주문 12건",
        detail: "주문 수집 정상 완료",
        detailMeta: "발주 대기 큐 업데이트",
        status: "정상",
        statusTone: "teal",
        due: "3분 전",
        action: "주문 보기",
        actionTone: "neutral",
        href: "/app/orders",
      },
    ],
  },
  products: {
    referenceId: "Ro2UR",
    eyebrow: "운영 관리 · 상품",
    title: "상품·재고 모니터링",
    description: "판매중 상품의 품절 위험, 옵션 매핑, 공급가 변동을 한 화면에서 확인하고 필요한 판매 조치를 고릅니다.",
    cta: "상품 동기화",
    sidebarTitle: "상품 위험",
    sidebarDescription: "매출 영향과 처리 시급도 기준입니다.",
    sideItems: [
      { label: "품절 위험", meta: "8개 · 판매중", tone: "teal", active: true },
      { label: "매핑 누락", meta: "4개 · 확인 필요", tone: "neutral" },
      { label: "판매중지 검토", meta: "3개 · 즉시 확인", tone: "red" },
    ],
    searchPlaceholder: "상품명, 옵션, 공급사 코드 검색",
    filterLabel: "위험 상품",
    columns: ["상품", "감지 내용", "상태", "영향", "운영 조치"],
    rows: [
      {
        work: "무선 미니 가습기",
        workMeta: "OC-8831 · 화이트",
        detail: "오너클랜 재고 2개 남음",
        detailMeta: "쿠팡 판매 18개",
        status: "품절 임박",
        statusTone: "amber",
        due: "상",
        action: "판매 조치",
        actionTone: "teal",
      },
      {
        work: "방수 욕실 매트",
        workMeta: "OC-1274 · 그레이",
        detail: "옵션 매핑 누락",
        detailMeta: "주문 3건 확인 필요",
        status: "확인 필요",
        statusTone: "red",
        due: "중",
        dueTone: "red",
        action: "매핑 확인",
        actionTone: "red",
      },
    ],
  },
  history: {
    referenceId: "H2Nuw",
    eyebrow: "운영 기록 · 알림",
    title: "작업 이력·알림",
    description: "누가 어떤 주문과 상품을 처리했는지, 어떤 알림이 발송됐는지 추적합니다.",
    cta: "이력 내보내기",
    sidebarTitle: "최근 활동",
    sidebarDescription: "중요 업무의 처리 흐름입니다.",
    sideItems: [
      { label: "오늘 처리", meta: "28건 · 정상 완료", tone: "teal", active: true },
      { label: "승인 보류", meta: "3건 · 사유 확인", tone: "amber" },
      { label: "실패 알림", meta: "1건 · 재확인", tone: "red" },
    ],
    searchPlaceholder: "작업자, 주문번호, 변경 내용 검색",
    filterLabel: "오늘 기록",
    columns: ["기록", "변경 내용", "상태", "시각", "보기"],
    rows: [
      {
        work: "CS 답변 승인",
        workMeta: "운영자 김하린",
        detail: "배송 지연 문의 답변 발송",
        detailMeta: "#CP-240518-1021 · 고객 알림 완료",
        status: "완료",
        statusTone: "teal",
        due: "09:42",
        action: "상세 보기",
        actionTone: "neutral",
        href: "/app/cs/detail",
      },
      {
        work: "상품 판매중지",
        workMeta: "운영자 이준",
        detail: "무선 가습기 화이트 품절 위험 처리",
        detailMeta: "재고 회복 시 재노출 예정",
        status: "완료",
        statusTone: "teal",
        due: "09:18",
        action: "상품 보기",
        actionTone: "teal",
        href: "/app/products",
      },
    ],
  },
  margins: {
    referenceId: "KiqBh",
    eyebrow: "가격 운영 · 마진",
    title: "가격·마진 모니터링",
    description: "공급가 변동과 쿠팡 판매가를 비교해 손실 위험 상품을 먼저 확인합니다.",
    cta: "가격 새로고침",
    sidebarTitle: "마진 위험",
    sidebarDescription: "손실 전환 가능성이 높은 상품입니다.",
    sideItems: [
      { label: "손실 위험", meta: "3개 · 즉시 확인", tone: "red", active: true },
      { label: "마진 하락", meta: "9개 · 가격 검토", tone: "amber" },
      { label: "정상", meta: "1,198개", tone: "teal" },
    ],
    searchPlaceholder: "상품명, 공급가, 판매가 검색",
    filterLabel: "위험 마진",
    columns: ["상품", "가격 변화", "상태", "마진", "처리"],
    rows: [
      {
        work: "캠핑 접이식 의자",
        workMeta: "OC-33192 · 쿠팡 판매중",
        detail: "공급가 18,400원 -> 21,900원",
        detailMeta: "현재 판매가 유지 시 예상 마진 -3.2%",
        status: "손실 위험",
        statusTone: "red",
        due: "-3.2%",
        dueTone: "red",
        action: "가격 조정",
        actionTone: "red",
      },
      {
        work: "실리콘 조리도구 세트",
        workMeta: "OC-44901 · 광고 노출중",
        detail: "경쟁가 하락으로 전환율 저하",
        detailMeta: "최소 마진 12% 이상 유지 가능",
        status: "검토",
        statusTone: "amber",
        due: "12.4%",
        dueTone: "amber",
        action: "가격 확인",
        actionTone: "teal",
      },
    ],
  },
} satisfies Record<string, MonitoringScreen>;
