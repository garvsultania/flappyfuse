import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the game title', () => {
    render(<App />)
    const titleElement = screen.getByRole('heading', { name: /flappy fuse/i })
    expect(titleElement).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    render(<App />)
    const mainElement = screen.getByRole('main')
    expect(mainElement).toBeInTheDocument()
    
    const headerElement = screen.getByRole('banner')
    expect(headerElement).toBeInTheDocument()
    
    const footerElement = screen.getByRole('contentinfo')
    expect(footerElement).toBeInTheDocument()
  })
}) 