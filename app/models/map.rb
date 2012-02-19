class Map < ActiveRecord::Base
  belongs_to :user
  has_many :geographic_events
  has_many :feeds
end
