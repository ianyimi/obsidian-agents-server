import { useEffect, useState } from "react"

let portalContainer: HTMLElement | null = null

function updatePortalTheme() {
  if (!portalContainer) return

  // Check if Obsidian is in dark mode
  const isDark = document.body.classList.contains('theme-dark')

  if (isDark) {
    portalContainer.classList.add('dark')
  } else {
    portalContainer.classList.remove('dark')
  }
}

export function getPortalContainer(): HTMLElement {
  if (!portalContainer) {
    portalContainer = document.createElement("div")
    portalContainer.className = "obsidian-agents-server-plugin"
    portalContainer.style.position = "fixed"
    portalContainer.style.top = "0"
    portalContainer.style.left = "0"
    portalContainer.style.zIndex = "9999"
    portalContainer.style.pointerEvents = "none"
    document.body.appendChild(portalContainer)

    // Set initial theme
    updatePortalTheme()

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      updatePortalTheme()
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    })
  }
  return portalContainer
}

export function usePortalContainer() {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const portal = getPortalContainer()
    updatePortalTheme()
    setContainer(portal)
  }, [])

  return container
}

export function cleanupPortalContainer() {
  if (portalContainer && portalContainer.parentNode) {
    portalContainer.parentNode.removeChild(portalContainer)
    portalContainer = null
  }
}
