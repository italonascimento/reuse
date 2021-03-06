import { shallow } from 'enzyme'
import 'jest'
import * as React from 'react'
import { lemni } from '../src'


interface Props {
  to: string
}


const Hello = lemni<Props>(() => ({
  view: ({props}) => (
    <div>Hello { props.to }</div>
  )
}))

test('Props', () => {
  const wrapper = shallow((<Hello to='Joe' />))
  expect(wrapper.text()).toBe('Hello Joe')

  wrapper.setProps({
    to: 'Joane'
  })
  expect(wrapper.text()).toBe('Hello Joane')
})
