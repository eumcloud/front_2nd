import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  Tag,
  TagCloseButton,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { useScheduleContext } from "./ScheduleContext.tsx";
import { Lecture, Props, SearchOption } from "./types.ts";
import { parseSchedule } from "./utils.ts";
import axios from "axios";
import { DAY_LABELS, TIME_SLOTS } from "./constants.ts";

const PAGE_SIZE = 100;

const createCachedFetch = () => {
  const cache: Record<string, Promise<Lecture[]>> = {};
  return (url: string) => {
    if (!cache[url]) {
      cache[url] = axios.get<Lecture[]>(url).then((response) => response.data);
    }
    return cache[url];
  };
};

const cachedFetch = createCachedFetch();

const fetchMajors = () => cachedFetch("/schedules-majors.json");
const fetchLiberalArts = () => cachedFetch("/schedules-liberal-arts.json");

export const fetchAllLectures = async () => {
  const start = performance.now();
  console.log("API 호출 시작: ", start);

  try {
    /** 여러번 호출하지만 캐시를 잘 사용하는지 확인 */
    const results = await Promise.all([
      (console.log("API Call 1", performance.now()), fetchMajors()),
      (console.log("API Call 2", performance.now()), fetchLiberalArts()),
      (console.log("API Call 3", performance.now()), fetchMajors()),
      (console.log("API Call 4", performance.now()), fetchLiberalArts()),
      (console.log("API Call 5", performance.now()), fetchMajors()),
      (console.log("API Call 6", performance.now()), fetchLiberalArts()),
    ]);

    const end = performance.now();
    console.log("모든 API 호출 완료 ", end);
    console.log("API 호출에 걸린 시간(ms): ", end - start);

    console.log(`Data Check :${JSON.stringify(results.flat(), null, 2)}`);
    // 모든 결과를 하나의 배열로 합칩니다.
    return results.flat();
  } catch (error) {
    console.error("API 호출 중 오류 발생:", error);
    throw error;
  }
};

// TODO: 이 컴포넌트에서 불필요한 연산이 발생하지 않도록 다양한 방식으로 시도해주세요.
const SearchDialog: React.FC<Props> = React.memo(({ searchInfo, onClose }) => {
  const { setSchedulesMap } = useScheduleContext();
  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const [searchOptions, setSearchOptions] = useState<SearchOption>({
    query: "",
    grades: [],
    days: [],
    times: [],
    majors: [],
    credits: undefined,
  });

  const filteredLectures = useMemo(() => {
    const { query = "", credits, grades, days, times, majors } = searchOptions;
    return lectures.filter((lecture) => {
      const matchesQuery =
        lecture.title.toLowerCase().includes(query.toLowerCase()) ||
        lecture.id.toLowerCase().includes(query.toLowerCase());
      const matchesGrade =
        grades.length === 0 || grades.includes(lecture.grade);
      const matchesMajor =
        majors.length === 0 || majors.includes(lecture.major);
      const matchesCredits =
        !credits || lecture.credits.startsWith(String(credits));
      const schedules = parseSchedule(lecture.schedule);
      const matchesDays =
        days.length === 0 || schedules.some((s) => days.includes(s.day));
      const matchesTimes =
        times.length === 0 ||
        schedules.some((s) => s.range.some((time) => times.includes(time)));

      return (
        matchesQuery &&
        matchesGrade &&
        matchesMajor &&
        matchesCredits &&
        matchesDays &&
        matchesTimes
      );
    });
  }, [lectures, searchOptions]);

  const visibleLectures = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredLectures.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredLectures, page]);

  const lastPage = Math.ceil(filteredLectures.length / PAGE_SIZE);

  const allMajors = useMemo(() => {
    const majorSet = new Set(lectures.map((lecture) => lecture.major));
    return Array.from(majorSet);
  }, [lectures]);

  const changeSearchOption = useCallback(
    (field: keyof SearchOption, value: SearchOption[typeof field]) => {
      setSearchOptions((prev) => ({ ...prev, [field]: value }));
      setPage(1);
      loaderWrapperRef.current?.scrollTo(0, 0);
    },
    []
  );

  const addSchedule = useCallback(
    (lecture: Lecture) => {
      if (!searchInfo) return;
      const { tableId } = searchInfo;
      const schedules = parseSchedule(lecture.schedule).map((schedule) => ({
        ...schedule,
        lecture,
      }));
      setSchedulesMap((prev) => ({
        ...prev,
        [tableId]: [...prev[tableId], ...schedules],
      }));
      onClose();
    },
    [searchInfo, setSchedulesMap, onClose]
  );

  useEffect(() => {
    fetchAllLectures().then(setLectures).catch(console.error);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && page < lastPage) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0, root: loaderWrapperRef.current }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [page, lastPage]);

  useEffect(() => {
    if (searchInfo) {
      setSearchOptions((prev) => ({
        ...prev,
        days: searchInfo.day ? [searchInfo.day] : [],
        times: searchInfo.time ? [searchInfo.time] : [],
      }));
      setPage(1);
    }
  }, [searchInfo]);

  const GradeCheckboxGroup = ({ grades, onChange }) => (
    <CheckboxGroup value={grades} onChange={onChange}>
      <HStack spacing={4}>
        {[1, 2, 3, 4].map((grade) => (
          <Checkbox key={grade} value={grade}>
            {grade}학년
          </Checkbox>
        ))}
      </HStack>
    </CheckboxGroup>
  );

  const DayCheckboxGroup = ({ days, onChange }) => (
    <CheckboxGroup value={days} onChange={onChange}>
      <HStack spacing={4}>
        {DAY_LABELS.map((day) => (
          <Checkbox key={day} value={day}>
            {day}
          </Checkbox>
        ))}
      </HStack>
    </CheckboxGroup>
  );

  const TimeCheckboxGroup = ({ times, onChange }) => (
    <CheckboxGroup colorScheme="green" value={times} onChange={onChange}>
      <Wrap spacing={1} mb={2}>
        {times
          .sort((a, b) => a - b)
          .map((time) => (
            <Tag key={time} size="sm" variant="outline" colorScheme="blue">
              <TagLabel>{time}교시</TagLabel>
              <TagCloseButton
                onClick={() => onChange(times.filter((v) => v !== time))}
              />
            </Tag>
          ))}
      </Wrap>
      <Stack
        spacing={2}
        overflowY="auto"
        h="100px"
        border="1px solid"
        borderColor="gray.200"
        borderRadius={5}
        p={2}
      >
        {TIME_SLOTS.map(({ id, label }) => (
          <Box key={id}>
            <Checkbox key={id} size="sm" value={id}>
              {id}교시({label})
            </Checkbox>
          </Box>
        ))}
      </Stack>
    </CheckboxGroup>
  );

  const MajorCheckboxGroup = ({ majors, allMajors, onChange }) => (
    <CheckboxGroup colorScheme="green" value={majors} onChange={onChange}>
      <Wrap spacing={1} mb={2}>
        {majors.map((major) => (
          <Tag key={major} size="sm" variant="outline" colorScheme="blue">
            <TagLabel>{major.split("<p>").pop()}</TagLabel>
            <TagCloseButton
              onClick={() => onChange(majors.filter((v) => v !== major))}
            />
          </Tag>
        ))}
      </Wrap>
      <Stack
        spacing={2}
        overflowY="auto"
        h="100px"
        border="1px solid"
        borderColor="gray.200"
        borderRadius={5}
        p={2}
      >
        {allMajors.map((major) => (
          <Box key={major}>
            <Checkbox key={major} size="sm" value={major}>
              {major.replace(/<p>/gi, " ")}
            </Checkbox>
          </Box>
        ))}
      </Stack>
    </CheckboxGroup>
  );

  return (
    <Modal isOpen={Boolean(searchInfo)} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="90vw" w="1000px">
        <ModalHeader>수업 검색</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* 검색 옵션 UI */}
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>검색어</FormLabel>
                <Input
                  placeholder="과목명 또는 과목코드"
                  value={searchOptions.query}
                  onChange={(e) => changeSearchOption("query", e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>학점</FormLabel>
                <Select
                  value={searchOptions.credits}
                  onChange={(e) =>
                    changeSearchOption(
                      "credits",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                >
                  <option value="">전체</option>
                  <option value="1">1학점</option>
                  <option value="2">2학점</option>
                  <option value="3">3학점</option>
                </Select>
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>학년</FormLabel>
                <GradeCheckboxGroup
                  grades={searchOptions.grades}
                  onChange={(value) =>
                    changeSearchOption("grades", value.map(Number))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>요일</FormLabel>
                <DayCheckboxGroup
                  days={searchOptions.days}
                  onChange={(value) =>
                    changeSearchOption("days", value as string[])
                  }
                />
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FormControl>
                <FormLabel>시간</FormLabel>
                <TimeCheckboxGroup
                  times={searchOptions.times}
                  onChange={(values) =>
                    changeSearchOption("times", values.map(Number))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>전공</FormLabel>
                <MajorCheckboxGroup
                  majors={searchOptions.majors}
                  allMajors={allMajors}
                  onChange={(values) =>
                    changeSearchOption("majors", values as string[])
                  }
                />
              </FormControl>
            </HStack>

            <Text align="right">검색결과: {filteredLectures.length}개</Text>

            {/* 검색 결과 테이블 */}
            <Box>
              <Table>
                <Thead>
                  <Tr>
                    <Th width="100px">과목코드</Th>
                    <Th width="50px">학년</Th>
                    <Th width="200px">과목명</Th>
                    <Th width="50px">학점</Th>
                    <Th width="150px">전공</Th>
                    <Th width="150px">시간</Th>
                    <Th width="80px"></Th>
                  </Tr>
                </Thead>
              </Table>

              <Box overflowY="auto" maxH="500px" ref={loaderWrapperRef}>
                <Table size="sm" variant="striped">
                  <Tbody>
                    {visibleLectures.map((lecture, index) => (
                      <Tr key={`${lecture.id}-${index}`}>
                        <Td width="100px">{lecture.id}</Td>
                        <Td width="50px">{lecture.grade}</Td>
                        <Td width="200px">{lecture.title}</Td>
                        <Td width="50px">{lecture.credits}</Td>
                        <Td
                          width="150px"
                          dangerouslySetInnerHTML={{ __html: lecture.major }}
                        />
                        <Td
                          width="150px"
                          dangerouslySetInnerHTML={{ __html: lecture.schedule }}
                        />
                        <Td width="80px">
                          <Button
                            size="sm"
                            colorScheme="green"
                            onClick={() => addSchedule(lecture)}
                          >
                            추가
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
                <Box ref={loaderRef} h="20px" />
              </Box>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});

export default SearchDialog;
