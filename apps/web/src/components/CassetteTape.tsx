import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

interface CassetteTapeProps {
  progress: number; // 0 to 1
  isPlaying?: boolean;
  className?: string;
}

interface TapeProps {
  isPlaying: boolean;
}

const Container = styled.div`
  margin: 0;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #ffe150;
`;

const TapeContainer = styled.div`
  width: 100%;
  max-width: 800px;
  aspect-ratio: 810 / 513.5;
`;

const StyledSvg = styled.svg`
  width: 100%;
  height: 100%;
  display: block;
`;

const Tape1 = styled.g<TapeProps>`
  transform-origin: 234px 234px;
  animation: ${props => props.isPlaying ? 'tapeAnimation 1s linear infinite' : 'none'};
`;

const Tape2 = styled.g<TapeProps>`
  transform-origin: 576px 234px;
  animation: ${props => props.isPlaying ? 'tapeAnimation 1s linear infinite' : 'none'};
`;

const CassetteTape: React.FC<CassetteTapeProps> = ({ progress, isPlaying = false, className }) => {
  const tape1Ref = useRef<SVGGElement>(null);
  const tape2Ref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (tape1Ref.current && tape2Ref.current) {
      // Calculate the rotation based on progress
      const rotation = progress * 360;
      tape1Ref.current.style.transform = `rotate(${-rotation}deg)`;
      tape2Ref.current.style.transform = `rotate(${rotation}deg)`;
    }
  }, [progress]);

  return (
    <Container className={className}>
      <TapeContainer>
        <StyledSvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 810 513.5" preserveAspectRatio="xMidYMid meet">
          <g id="Tape">
            <Tape1 ref={tape1Ref} isPlaying={isPlaying}>
              <g id="TapeReel">
                <circle cx="234" cy="234" r="160" fill="#1a1a1a">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    from="160"
                    to="85"
                  />
                </circle>
                <circle cx="234" cy="234" r="140" stroke="#333" fill="none">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    from="140"
                    to="65"
                  />
                </circle>
                <circle cx="234" cy="234" r="120" stroke="#333" fill="none">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    from="120"
                    to="45"
                  />
                </circle>
                <circle cx="234" cy="234" r="100" stroke="#333" fill="none">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    from="100"
                    to="25"
                  />
                </circle>
              </g>
              <circle cx="234" cy="234" r="86.05" fill="#f2f2f2" />
              <circle cx="234" cy="234" r="40.49" fill="#bfbfbf" />
              <rect
                x="246.52"
                y="198.18"
                width="10.12"
                height="10.12"
                transform="translate(133.98 -98.04) rotate(29.74)"
                fill="#f2f2f2"
              />
              <rect
                x="211.36"
                y="259.7"
                width="10.12"
                height="10.12"
                transform="translate(159.87 -72.49) rotate(29.74)"
                fill="#f2f2f2"
              />
              <rect
                x="264.37"
                y="228.74"
                width="10.12"
                height="10.12"
                transform="translate(501.7 -36.95) rotate(89.68)"
                fill="#f2f2f2"
              />
              <rect
                x="193.51"
                y="229.14"
                width="10.12"
                height="10.12"
                transform="translate(431.64 34.31) rotate(89.68)"
                fill="#f2f2f2"
              />
              <rect
                x="210.95"
                y="198.41"
                width="10.12"
                height="10.12"
                transform="translate(-73.39 137.84) rotate(-30.51)"
                fill="#f2f2f2"
              />
              <rect
                x="246.93"
                y="259.46"
                width="10.12"
                height="10.12"
                transform="translate(-99.41 164.56) rotate(-30.51)"
                fill="#f2f2f2"
              />
              <circle cx="234" cy="234" r="24.18" fill="#1a1a1a" />
              <polygon
                points="234 198.38 203.15 251.81 264.85 251.81 234 198.38"
                fill="#1a1a1a"
              />
              <line
                x1="234"
                y1="198.38"
                x2="234"
                y2="234"
                fill="none"
                stroke="#f2f2f2"
                strokeMiterlimit="10"
              />
              <line
                x1="203.15"
                y1="251.81"
                x2="234"
                y2="234"
                fill="none"
                stroke="#f2f2f2"
                strokeMiterlimit="10"
              />
              <line
                x1="264.85"
                y1="251.81"
                x2="234"
                y2="234"
                fill="none"
                stroke="#f2f2f2"
                strokeMiterlimit="10"
              />
            </Tape1>
            <Tape2 ref={tape2Ref} isPlaying={isPlaying}>
              <g id="TapeReel">
                <circle cx="576" cy="234" r="161.97" fill="#1a1a1a">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    to="160"
                    from="85"
                  />
                </circle>
                <circle cx="576" cy="234" r="140" stroke="#333" fill="none">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    to="140"
                    from="65"
                  />
                </circle>
                <circle cx="576" cy="234" r="120" stroke="#333" fill="none">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    to="120"
                    from="45"
                  />
                </circle>
                <circle cx="576" cy="234" r="100" stroke="#333" fill="none">
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="15s"
                    repeatCount="indefinite"
                    to="100"
                    from="25"
                  />
                </circle>
              </g>
              <circle cx="576" cy="234" r="86.05" fill="#f2f2f2" />
              <circle cx="576" cy="234" r="40.49" fill="#bfbfbf" />
              <rect
                x="588.52"
                y="198.18"
                width="10.12"
                height="10.12"
                transform="translate(179.04 -267.72) rotate(29.74)"
                fill="#f2f2f2"
              />
              <rect
                x="553.36"
                y="259.7"
                width="10.12"
                height="10.12"
                transform="translate(204.94 -242.17) rotate(29.74)"
                fill="#f2f2f2"
              />
              <rect
                x="606.37"
                y="228.74"
                width="10.12"
                height="10.12"
                transform="translate(841.77 -378.94) rotate(89.68)"
                fill="#f2f2f2"
              />
              <rect
                x="535.51"
                y="229.14"
                width="10.12"
                height="10.12"
                transform="translate(771.71 -307.68) rotate(89.68)"
                fill="#f2f2f2"
              />
              <rect
                x="552.95"
                y="198.41"
                width="10.12"
                height="10.12"
                transform="translate(-26.04 311.47) rotate(-30.51)"
                fill="#f2f2f2"
              />
              <rect
                x="588.93"
                y="259.46"
                width="10.12"
                height="10.12"
                transform="translate(-52.05 338.19) rotate(-30.51)"
                fill="#f2f2f2"
              />
              <circle cx="576" cy="234" r="24.18" fill="#1a1a1a" />
              <polygon
                points="576 198.38 545.15 251.81 606.85 251.81 576 198.38"
                fill="#1a1a1a"
              />
              <line
                x1="576"
                y1="198.38"
                x2="576"
                y2="234"
                fill="none"
                stroke="#f2f2f2"
                strokeMiterlimit="10"
              />
              <line
                x1="545.15"
                y1="251.81"
                x2="576"
                y2="234"
                fill="none"
                stroke="#f2f2f2"
                strokeMiterlimit="10"
              />
              <line
                x1="606.85"
                y1="251.81"
                x2="576"
                y2="234"
                fill="none"
                stroke="#f2f2f2"
                strokeMiterlimit="10"
              />
            </Tape2>
          </g>
          <g id="Cassette">
            <path
              d="M780.41,0H29.59A20.59,20.59,0,0,0,9,20.59V483.41A20.59,20.59,0,0,0,29.59,504H780.41A20.59,20.59,0,0,0,801,483.41V20.59A20.59,20.59,0,0,0,780.41,0ZM297,189H513v90H297ZM220.5,486A13.5,13.5,0,1,1,234,472.5,13.49,13.49,0,0,1,220.5,486ZM234,279a45,45,0,1,1,45-45A45,45,0,0,1,234,279Zm58.5,198A13.5,13.5,0,1,1,306,463.5,13.49,13.49,0,0,1,292.5,477Zm225,0A13.5,13.5,0,1,1,531,463.5,13.49,13.49,0,0,1,517.5,477Zm72,9A13.5,13.5,0,1,1,603,472.5,13.49,13.49,0,0,1,589.5,486ZM576,279a45,45,0,1,1,45-45A45,45,0,0,1,576,279Z"
              fill="#262626"
            />
            <path d="M654.47,501.21,631.65,394.7a9.74,9.74,0,0,0-9.53-7.7H187.88a9.74,9.74,0,0,0-9.53,7.7L155.53,501.21A9.74,9.74,0,0,0,165.06,513H644.94A9.74,9.74,0,0,0,654.47,501.21ZM220.5,486A13.5,13.5,0,1,1,234,472.5,13.49,13.49,0,0,1,220.5,486Zm72-9A13.5,13.5,0,1,1,306,463.5,13.49,13.49,0,0,1,292.5,477Zm225,0A13.5,13.5,0,1,1,531,463.5,13.49,13.49,0,0,1,517.5,477Zm72,9A13.5,13.5,0,1,1,603,472.5,13.49,13.49,0,0,1,589.5,486Z" fill="#262626" stroke="#bfbfbf" strokeMiterlimit="10" />
            <rect x="297" y="189" width="216" height="90" fill="#262626" opacity="0.67" />
            <rect y="288" width="18" height="144" rx="3.98" fill="#262626" />
            <rect x="792" y="288" width="18" height="144" rx="3.98" fill="#262626" />
          </g>
          <g id="Label">
            <path d="M45,36V369H765V36ZM648,297H162V171H648Z" fill="#bfbfbf" />
            <rect x="45" y="36" width="720" height="27" fill="#ec1d25" />
            <rect x="45" y="63" width="720" height="81" fill="#f2f2f2" />
            <rect x="45" y="315" width="720" height="54" fill="#1a1a1a" />
          </g>
        </StyledSvg>
      </TapeContainer>
    </Container>
  );
};

export default CassetteTape; 