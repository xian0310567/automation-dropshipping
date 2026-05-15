import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "./monitoring-primitives";

export function OrderDetailReviewScreen() {
  return (
    <section className="ops-screen order-detail-screen" data-reference="P3jyw1">
      <header className="ops-page-header">
        <div>
          <p className="ops-eyebrow">주문 #CP-240518-1021</p>
          <h1>발주 승인 검토</h1>
          <p className="ops-description">공급사 발주 전에 취소 위험, 재고, 중복 발주, 개인정보 마스킹 상태를 확인합니다.</p>
        </div>
        <Button asChild className="ops-secondary-button" size="sm" variant="outline">
          <Link href="/app/orders">목록으로</Link>
        </Button>
      </header>

      <section className="order-detail-grid" aria-label="발주 승인 검토">
        <Card className="order-detail-main" data-motion="detail-main">
          <div className="review-panel-header">
            <div>
              <p>쿠팡 주문</p>
              <h2>#CP-240518-1021</h2>
            </div>
            <Pill tone="amber">승인 대기</Pill>
          </div>

          <section className="order-product-card">
            <div>
              <h3>스타일리스 선풍기</h3>
              <p>수취인 김서연 · 제주 제주시 · 요청사항 문 앞</p>
            </div>
            <strong>78,400원</strong>
          </section>

          <div className="review-checklist">
            <div>
              <strong>발주처리안</strong>
              <span>추가 배송비 확인 후 CSV 발주를 진행합니다.</span>
            </div>
            <div>
              <strong>주의</strong>
              <span>10시~23시 주문 확인 필요 · 재고 2건 남음</span>
            </div>
            <div>
              <strong>CS</strong>
              <span>문의 1건이 있어 발주 전 출고 예정일 확인이 필요합니다.</span>
            </div>
          </div>

          <div className="order-detail-split">
            <article>
              <h2>공급사 확인</h2>
              <p>Ownerclan SKU OC-99821 · 옵션 W-80 / 우산 추가 배송비 3,900원으로 CSV 발주 가능</p>
            </article>
            <article>
              <h2>작업 이력</h2>
              <p>오늘 9:12 재고 확인 · 상품 설명 변경 이후 가격 기준 2건 자동 검토</p>
            </article>
          </div>
        </Card>

        <Card className="order-summary-card">
          <h2>승인 액션</h2>
          <Pill tone="amber">주의</Pill>
          <p>옵션명과 추가 배송비가 확인되면 CSV 발주를 진행할 수 있습니다.</p>
          <Button type="button" className="ops-action tone-teal" size="sm">
            CSV 발주 승인
          </Button>
          <Button type="button" className="ops-action tone-neutral" size="sm" variant="outline">
            보류 사유 남기기
          </Button>
        </Card>
      </section>
    </section>
  );
}

export function ApprovalPanelScreen() {
  return (
    <section className="ops-screen review-screen" data-reference="mFQBl">
      <header className="ops-page-header">
        <div>
          <p className="ops-eyebrow">승인 검토 · 오늘 처리</p>
          <h1>승인 상세 패널</h1>
          <p className="ops-description">주문, 상품, 고객 문의를 한 화면에서 대조하고 운영자가 최종 처리합니다.</p>
        </div>
        <Button asChild className="ops-secondary-button" size="sm" variant="outline">
          <Link href="/app/orders">주문 목록</Link>
        </Button>
      </header>

      <section className="review-grid" aria-label="승인 상세">
        <aside className="review-queue">
          <h2>검토 대기</h2>
          <Button type="button" className="review-card is-active" variant="outline">
            <span>무선 가습기 화이트</span>
            <strong>#CP-240518-1021</strong>
            <small>옵션·재고 확인 필요</small>
          </Button>
          <Button type="button" className="review-card" variant="outline">
            <span>수납 바스켓 4P</span>
            <strong>#CP-240518-0984</strong>
            <small>송장 입력 대기</small>
          </Button>
          <Button type="button" className="review-card danger" variant="outline">
            <span>캠핑 접이식 의자</span>
            <strong>#CP-240518-0850</strong>
            <small>마진 손실 위험</small>
          </Button>
        </aside>

        <section className="review-panel">
          <div className="review-panel-header">
            <div>
              <p>쿠팡 주문</p>
              <h2>#CP-240518-1021</h2>
            </div>
            <Pill tone="amber">승인 대기</Pill>
          </div>

          <div className="review-product">
            <div className="review-product-image" aria-hidden="true" />
            <div>
              <h3>무선 가습기 화이트</h3>
              <p>수취인 김서연 · 제주 제주시 · 요청사항 문 앞</p>
              <dl>
                <div>
                  <dt>쿠팡 옵션</dt>
                  <dd>화이트 / 기본형</dd>
                </div>
                <div>
                  <dt>공급사 옵션</dt>
                  <dd>화이트 / USB 케이블 포함</dd>
                </div>
                <div>
                  <dt>예상 마진</dt>
                  <dd>14.8%</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="review-checklist">
            <div>
              <strong>재고</strong>
              <span>공급사 재고 2개, 오늘 주문 1건</span>
            </div>
            <div>
              <strong>가격</strong>
              <span>공급가 변동 없음, 마진 기준 통과</span>
            </div>
            <div>
              <strong>CS</strong>
              <span>배송 지연 문의가 있어 발송 예정일 답변 필요</span>
            </div>
          </div>

          <div className="review-actions">
            <Button type="button" className="ops-action tone-neutral" size="sm" variant="outline">
              보류
            </Button>
            <Button type="button" className="ops-action tone-red" size="sm" variant="destructive">
              취소 검토
            </Button>
            <Button type="button" className="ops-action tone-teal" size="sm">
              발주 승인
            </Button>
          </div>
        </section>
      </section>
    </section>
  );
}

export function CsDetailScreen() {
  return (
    <section className="ops-screen review-screen" data-reference="LFAF9">
      <header className="ops-page-header">
        <div>
          <p className="ops-eyebrow">CS 상세 · 답변 승인</p>
          <h1>답변 초안 승인</h1>
          <p className="ops-description">주문 상황과 공급사 출고 정보를 확인한 뒤 고객에게 보낼 답변을 확정합니다.</p>
        </div>
        <Button asChild className="ops-secondary-button" size="sm" variant="outline">
          <Link href="/app/cs">CS 인박스</Link>
        </Button>
      </header>

      <section className="cs-detail-grid" aria-label="CS 답변 상세">
        <article className="cs-thread">
          <p className="ops-eyebrow">고객 문의</p>
          <h2>배송이 언제 시작되나요?</h2>
          <p>
            어제 결제했는데 아직 배송 준비중으로 보여요. 선물용이라 오늘 출고 가능 여부를 알고 싶습니다.
          </p>
          <div className="cs-meta">
            <span>#CP-240518-1021</span>
            <span>SLA 42분 남음</span>
          </div>
        </article>

        <article className="cs-answer">
          <div className="review-panel-header">
            <div>
              <p>답변 초안</p>
              <h2>오늘 출고 예정 안내</h2>
            </div>
            <Pill tone="teal">검토 가능</Pill>
          </div>
          <p>
            고객님, 주문하신 상품은 공급사 출고 확인이 완료되어 오늘 오후 출고 예정입니다. 송장 번호가 등록되는 즉시
            쿠팡 주문 내역에서 확인하실 수 있습니다.
          </p>
          <div className="review-checklist">
            <div>
              <strong>주문 상태</strong>
              <span>결제완료 · 발주 승인 대기</span>
            </div>
            <div>
              <strong>공급사 확인</strong>
              <span>오늘 16시 이전 출고 가능</span>
            </div>
            <div>
              <strong>권장 처리</strong>
              <span>답변 발송 후 주문 상세에서 발주 승인</span>
            </div>
          </div>
          <div className="review-actions">
            <Button type="button" className="ops-action tone-neutral" size="sm" variant="outline">
              수정 요청
            </Button>
            <Button type="button" className="ops-action tone-teal" size="sm">
              답변 발송
            </Button>
          </div>
        </article>
      </section>
    </section>
  );
}
