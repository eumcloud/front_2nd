import { http, HttpResponse } from 'msw'

let schedules = [
  { id: 1, text: '테스트 할 일 1', completed: false },
  { id: 2, text: '테스트 할 일 2', completed: true },
]

export const mockApiHandlers = [
  http.get('/lookup', () => {
    return HttpResponse.json(schedules)
  }),

  http.post('/create', async ({ request }) => {
    const { text } = await request.json() as { text: string }
    const newTodo = { id: schedules.length + 1, text, completed: false }
    schedules.push(newTodo)
    return HttpResponse.json(newTodo, { status: 201 })
  }),

  http.put('/replace/:id', async ({ params, request }) => {
    const { id } = params
    const updates = await request.json() as Record<string, unknown>;
    schedules = schedules.map(todo =>
      todo.id === Number(id) ? { ...todo, ...updates } : todo
    )
    return HttpResponse.json(schedules.find(todo => todo.id === Number(id)))
  }),

  http.delete('/del/:id', ({ params }) => {
    const { id } = params
    schedules = schedules.filter(todo => todo.id !== Number(id))
    return new HttpResponse(null, { status: 204 })
  }),
]
