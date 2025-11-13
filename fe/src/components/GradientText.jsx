import './GradientText.css'

export default function GradientText({
  children,
  className = '',
  colors = ['#40ffaa', '#4079ff', '#40ffaa', '#4079ff', '#40ffaa'],
  animationSpeed = 8,
  showBorder = false,
  showShadow = false,
}) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(', ')})`,
    animationDuration: `${animationSpeed}s`,
  }

  return (
    <span className={`animated-gradient-text ${className}`}>
      {showBorder && <span className="gradient-overlay" style={gradientStyle}></span>}
      {showShadow && (
        <span className="text-shadow" aria-hidden="true">
          {children}
        </span>
      )}
      <span className="text-content" style={gradientStyle}>
        {children}
      </span>
    </span>
  )
}
