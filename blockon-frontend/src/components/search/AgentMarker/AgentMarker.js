import React from 'react';
import { Link } from 'react-router-dom';
import marker from 'static/images/icon/marker.png';
import { Popover, Button } from 'antd';
import './AgentMarker.scss';

const getContent = agent => {
  return (
    <div className="infowindow">
      <p>{agent.road_address_name}</p>
      <Link to={{ pathname: '/contract', state: { activeTab: 'review' } }}>
        <Button type="primary">리뷰 보기</Button>
      </Link>
    </div>
  );
};

const AgentMarker = ({ agent }) => {
  return (
    <div className="AgentMarker">
      <Popover content={getContent(agent)} title={agent.place_name}>
        <img src={marker} alt="marker" style={{ width: '40px' }} />
      </Popover>
    </div>
  );
};

export default AgentMarker;
