import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  act,
  renderHook,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCalendarView } from "../useCalendarView.ts";
import { Event } from "../../../types.ts";
import createMockServer from "./createMockServer.ts";
import { useEventOperations } from "../useEventOperations.ts";
import { http, HttpResponse } from "msw";
// import { useNotifications } from "../useNotifications.ts";
// import { fillZero, formatDate } from "../../utils/dateUtils.ts";
import { useSearch } from "../useSearch.ts";
import App from "../../App";
import { exp } from "@tensorflow/tfjs";

const MOCK_EVENT_1: Event = {
  id: 99,
  title: "주간 회의",
  date: "2024-08-01",
  startTime: "09:00",
  endTime: "10:00",
  description: "주간 팀 미팅",
  location: "회의실 B",
  category: "업무",
  repeat: { type: "weekly", interval: 1 },
  notificationTime: 10,
};

const events: Event[] = [{ ...MOCK_EVENT_1 }];

const server = createMockServer(events);

const mockToast = vi.fn();

vi.mock("@chakra-ui/react", async () => {
  const actual = await vi.importActual("@chakra-ui/react");
  return {
    ...actual,
    useToast: () => (props: never) => mockToast(props),
  };
});

// Console log spy
const consoleLogSpy = vi.spyOn(console, "log");

// 반복 일정 추가 함수
const addRepeatingEvent = async (user: ReturnType<typeof userEvent.setup>) => {
  expect(screen.getByLabelText("반복 설정")).toBeChecked();

  const title = "주간 회의";
  await user.type(screen.getByLabelText("제목"), title);
  console.log("제목 입력:", title);

  const date = "2024-08-01";
  await user.type(screen.getByLabelText("날짜"), date);
  console.log("날짜 입력:", date);

  const startTime = "09:00";
  await user.type(screen.getByLabelText("시작 시간"), startTime);
  console.log("시작 시간 입력:", startTime);

  const endTime = "10:00";
  await user.type(screen.getByLabelText("종료 시간"), endTime);
  console.log("종료 시간 입력:", endTime);

  const repeatType = "weekly";
  await user.selectOptions(screen.getByLabelText("반복 유형"), repeatType);
  console.log("반복 유형 선택:", repeatType);

  const repeatInterval = "1";
  await user.type(screen.getByLabelText("반복 간격"), repeatInterval);
  console.log("반복 간격 입력:", repeatInterval);

  const endDate = "2024-8-31";
  await user.type(screen.getByLabelText("반복 종료일"), endDate);
  console.log("반복 종료일 입력:", endDate);

  await act(async () => {
    await userEvent.click(screen.getByTestId("event-submit-button"));
  });
  console.log("일정 제출 완료");
  // console.log(screen.debug());
};

beforeAll(async () => {
  server.listen();

  // 페이지 리프레시 시뮬레이션
  const { unmount } = render(<App />);
  unmount();
  render(<App />);

  // 반복 일정 추가
  const user = userEvent.setup();
  await addRepeatingEvent(user);
});

afterAll(() => {
  server.close();
  vi.clearAllMocks();
  cleanup();
});

describe("반복 일정 기능 테스트", () => {
  describe("1. 반복 유형 선택", () => {
    test("일정 생성 시 반복 유형을 선택할 수 있다", async () => {
      // Given
      const user = userEvent.setup();
      render(<App />);

      // 반복 유형 선택
      const repeatTypeSelect = screen.getByRole("combobox", {
        name: /반복 유형/i,
      });

      await user.selectOptions(repeatTypeSelect, "weekly");

      // Then
      expect(repeatTypeSelect).toHaveValue("weekly");
    });

    test("모든 반복 유형(매일, 매주, 매월, 매년)을 선택할 수 있다", async () => {
      // Given
      const user = userEvent.setup();
      render(<App />);

      // When
      /** 반복설정이 체크되어있다 */

      const repeatTypeSelect = screen.getByRole("combobox", {
        name: /반복 유형/i,
      });
      const options = screen.getAllByRole("option");

      expect(repeatTypeSelect).toHaveLength(4); // 4개의 옵션이 있어야 함

      const optionValues = options.map((option) =>
        option.getAttribute("value")
      );
      expect(optionValues).toEqual(
        expect.arrayContaining(["daily", "weekly", "monthly", "yearly"])
      );

      const optionTexts = options.map((option) => option.textContent);
      expect(optionTexts).toEqual(
        expect.arrayContaining(["매일", "매주", "매월", "매년"])
      );

      // 각 옵션을 선택할 수 있는지 확인
      for (const value of ["daily", "weekly", "monthly", "yearly"]) {
        await user.selectOptions(repeatTypeSelect, value);
        expect(repeatTypeSelect).toHaveValue(value);
      }
    });
  });

  describe("2. 반복 간격 설정", () => {
    test("매주 반복에 대해 간격을 설정할 수 있다", async () => {
      // Given
      const user = userEvent.setup();
      render(<App />);
      await user.clear(screen.getByLabelText("반복 간격"));

      // When
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "2");

      // Then
      expect(screen.getByLabelText("반복 간격")).toHaveValue(2);
    });
  });

  describe("3. 반복 일정 표시", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2024-08-01"));
    test("월간 뷰에서 반복 일정이 주기적으로 추가되어 표시된다", async () => {
      // Given
      const user = userEvent.setup();
      render(<App />);

      // When
      /* beforeAll에서 일정 자동추가*/
      const searchInput = screen.getByPlaceholderText("검색어를 입력하세요");
      await user.type(searchInput, "주간 회의");

      // Then
      const eventList = screen.getByTestId("event-list");
      const searchResults = within(eventList).getAllByText("주간 회의");
      expect(searchResults.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe.skip("4. 예외 날짜 처리", () => {
    test("반복 일정 중 특정 날짜를 제외할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      // 반복 일정 생성
      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");

      // 예외 날짜 추가
      await user.click(screen.getByText("예외 날짜 추가"));
      await user.type(screen.getByLabelText("예외 날짜"), "2024-08-15");

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      // 월간 뷰에서 해당 날짜에 일정이 없는지 확인
      const monthView = await screen.findByTestId("month-view");
      const exceptedDate = within(monthView).queryByText("주간 회의", {
        selector: '[data-date="2024-08-15"]',
      });
      expect(exceptedDate).not.toBeInTheDocument();
    });

    test("반복 일정 중 특정 날짜의 일정을 수정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      // 반복 일정 생성
      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      // 특정 날짜의 일정 수정
      const eventToModify = screen.getByText("주간 회의", {
        selector: '[data-date="2024-08-08"]',
      });
      await user.click(eventToModify);
      await user.type(screen.getByLabelText("제목"), " (변경됨)");
      await user.click(screen.getByText("이 일정만 수정"));

      // 수정된 일정 확인
      const modifiedEvent = screen.getByText("주간 회의 (변경됨)", {
        selector: '[data-date="2024-08-08"]',
      });
      expect(modifiedEvent).toBeInTheDocument();
    });
  });

  describe.skip("5. 반복 종료 조건", () => {
    test("특정 날짜까지 반복되도록 설정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");
      await user.type(screen.getByLabelText("반복 종료일"), "2024-08-31");

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      const monthView = await screen.findByTestId("month-view");
      const eventsInAugust = within(monthView).queryAllByText("주간 회의");
      expect(eventsInAugust.length).toBe(5); // 8월의 목요일 수

      // 9월로 이동
      await user.click(screen.getByText("다음 달"));
      const eventsInSeptember = within(monthView).queryAllByText("주간 회의");
      expect(eventsInSeptember.length).toBe(0);
    });

    test("특정 횟수만큼 반복되도록 설정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");
      await user.click(screen.getByLabelText("반복 횟수"));
      await user.type(screen.getByLabelText("반복 횟수"), "3");

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      const monthView = await screen.findByTestId("month-view");
      const events = within(monthView).queryAllByText("주간 회의");
      expect(events.length).toBe(3);
    });

    test("종료 없이 계속 반복되도록 설정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");
      await user.click(screen.getByLabelText("종료 없음"));

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      // 여러 달로 이동하며 일정이 계속 표시되는지 확인
      for (let i = 0; i < 3; i++) {
        const monthView = await screen.findByTestId("month-view");
        const events = within(monthView).queryAllByText("주간 회의");
        expect(events.length).toBeGreaterThan(0);
        await user.click(screen.getByText("다음 달"));
      }
    });
  });

  describe.skip("6. 요일 지정 (주간 반복의 경우)", () => {
    test("주간 반복 시 특정 요일을 선택할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");
      await user.click(screen.getByLabelText("월요일"));
      await user.click(screen.getByLabelText("수요일"));
      await user.click(screen.getByLabelText("금요일"));

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      const monthView = await screen.findByTestId("month-view");
      const mondays = within(monthView).queryAllByText("주간 회의", {
        selector: '[data-day="1"]',
      });
      const wednesdays = within(monthView).queryAllByText("주간 회의", {
        selector: '[data-day="3"]',
      });
      const fridays = within(monthView).queryAllByText("주간 회의", {
        selector: '[data-day="5"]',
      });

      expect(mondays.length).toBeGreaterThan(0);
      expect(wednesdays.length).toBeGreaterThan(0);
      expect(fridays.length).toBeGreaterThan(0);
    });
  });

  describe.skip("7. 월간 반복 옵션", () => {
    test("매월 특정 날짜에 반복되도록 설정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByLabelText("제목"), "월간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-15");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "monthly");
      await user.type(screen.getByLabelText("반복 간격"), "1");

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      // 여러 달로 이동하며 매월 15일에 일정이 있는지 확인
      for (let i = 0; i < 3; i++) {
        const monthView = await screen.findByTestId("month-view");
        const event = within(monthView).queryByText("월간 회의", {
          selector: '[data-date$="-15"]',
        });
        expect(event).toBeInTheDocument();
        await user.click(screen.getByText("다음 달"));
      }
    });

    test("매월 특정 순서의 요일에 반복되도록 설정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByLabelText("제목"), "월간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "monthly");
      await user.type(screen.getByLabelText("반복 간격"), "1");
      await user.selectOptions(
        screen.getByLabelText("월간 반복 옵션"),
        "firstThursday"
      );

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      // 여러 달로 이동하며 매월 첫 번째 목요일에 일정이 있는지 확인
      for (let i = 0; i < 3; i++) {
        const monthView = await screen.findByTestId("month-view");
        const firstThursday = within(monthView).queryByText("월간 회의", {
          selector: '[data-day="4"]:first-of-type',
        });
        expect(firstThursday).toBeInTheDocument();
        await user.click(screen.getByText("다음 달"));
      }
    });
  });

  describe.skip("8. 반복 일정 수정", () => {
    test("반복 일정의 단일 일정을 수정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      // 반복 일정 생성
      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      // 특정 날짜의 일정 수정
      const eventToModify = screen.getByText("주간 회의", {
        selector: '[data-date="2024-08-08"]',
      });
      await user.click(eventToModify);
      await user.type(screen.getByLabelText("제목"), " (변경됨)");
      await user.click(screen.getByText("이 일정만 수정"));

      // 수정된 일정 확인
      const modifiedEvent = screen.getByText("주간 회의 (변경됨)", {
        selector: '[data-date="2024-08-08"]',
      });
      expect(modifiedEvent).toBeInTheDocument();

      const unmodifiedEvent = screen.getByText("주간 회의", {
        selector: '[data-date="2024-08-15"]',
      });
      expect(unmodifiedEvent).toBeInTheDocument();
    });

    test("반복 일정의 모든 일정을 수정할 수 있다", async () => {
      const user = userEvent.setup();
      render(<App />);

      // 반복 일정 생성
      await user.type(screen.getByLabelText("제목"), "주간 회의");
      await user.type(screen.getByLabelText("날짜"), "2024-08-01");
      await user.selectOptions(screen.getByLabelText("반복 유형"), "weekly");
      await user.type(screen.getByLabelText("반복 간격"), "1");

      await act(async () => {
        await userEvent.click(screen.getByTestId("event-submit-button"));
      });

      // 모든 일정 수정
      const eventToModify = screen.getByText("주간 회의", {
        selector: '[data-date="2024-08-01"]',
      });
      await user.click(eventToModify);
      await user.type(screen.getByLabelText("제목"), " (전체 변경)");
      await user.click(screen.getByText("모든 일정 수정"));

      // 여러 주의 일정이 모두 변경되었는지 확인
      const modifiedEvents = screen.queryAllByText("주간 회의 (전체 변경)");
      expect(modifiedEvents.length).toBeGreaterThan(1);

      // 변경되지 않은 원래 제목의 일정이 없는지 확인
      const originalEvents = screen.queryAllByText("주간 회의");
      expect(originalEvents.length).toBe(0);
    });
  });
});
