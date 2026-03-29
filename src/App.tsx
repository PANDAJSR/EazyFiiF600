import { ConfigProvider, Layout } from 'antd'

function App() {
  return (
    <ConfigProvider>
      <Layout style={{ minHeight: '100vh', background: '#fff' }} />
    </ConfigProvider>
  )
}

export default App
